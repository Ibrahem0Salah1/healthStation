import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { memberships, tenants } from "@repo/database";

import type { TRPCContext } from "./context";

/**
 * NEW CONCEPT — the transformer.
 *
 * tRPC sends JSON over HTTP. JSON has no Date, no Map, no BigInt, no undefined.
 * A Drizzle row is full of `Date` columns. Without a transformer, `createdAt`
 * arrives in the browser as a STRING and every `.getMonth()` on it is
 * `NaN` — with no error anywhere, just quietly wrong values.
 *
 * superjson wraps the payload with type metadata so Date survives the trip.
 *
 * THE RULE THAT MATTERS: the transformer must be declared on BOTH ends. Server
 * in `initTRPC().create()` (below) and client in `utils/trpc.ts`. Configure
 * only one and every Date silently degrades to a string.
 */
export const t = initTRPC
  .context<TRPCContext>()
  .create({
    transformer: superjson,
  });

export const router = t.router;
export const middleware = t.middleware;

/**
 * Per-request correlation id. Attached to every log line that request
 * produces, so a user reporting "it failed at 3pm" maps to one trace.
 */
const requestInfo = t.middleware(async ({ next }) => {
  return next({ ctx: { requestId: crypto.randomUUID() } });
});

/**
 * EVERY tenant-scoped procedure accepts this field. It is the URL segment:
 * `/{tenantSlug}/shop` → `{ tenantSlug: "cairo-heart" }`.
 *
 * SECURITY: this is a *selector*, not an *authority*. Naming a tenant only
 * says "I want to read this clinic's public data." It grants nothing. The
 * thing that grants authority is a MEMBERSHIP, which is looked up from the
 * session cookie and can never appear in a request body.
 *
 * That distinction is the whole authorization model: a client can freely
 * choose which tenant it asks about, and the server independently decides
 * whether that client is allowed to.
 */
const tenantSlugSchema = z.object({
  tenantSlug: z.string().min(1),
});

/**
 * Resolves `input.tenantSlug` → `ctx.tenant`. Runs once per procedure call.
 *
 * ── WHY THERE IS NO `...ctx` SPREAD HERE ──
 *
 * `next({ ctx: X })` MERGES X into the existing context; it does not replace
 * it. So the only thing this middleware should pass is what it ADDS.
 *
 * The previous code wrote `next({ ctx: { ...ctx, tenant } })`. That looks
 * safer and is actively harmful: inside a bare `t.middleware` the `ctx`
 * parameter is typed as the BASE `TRPCContext`, where `user` is
 * `User | null`. Spreading it copied that widened type back over a context
 * that `isAuthed` had already narrowed, and every downstream middleware then
 * saw `ctx.user` as possibly null. The runtime was correct; the TYPE was a
 * lie, and it is the type that decides whether a future edit compiles.
 *
 * Passing only `{ tenant }` keeps the narrowing that `isAuthed` performed.
 *
 * This middleware is shared by the public and admin branches on purpose: the
 * two need identical resolution logic and must differ ONLY on whether a
 * membership is required. Sharing the resolution and forking the
 * authorization is what makes that difference auditable on one screen.
 *
 * `input` is typed `unknown` on a bare middleware, so it is re-validated here
 * against the SAME schema the procedures use. One source of truth — the
 * previous version hand-rolled a second, looser check inline.
 */
const resolveTenant = t.middleware(async ({ ctx, next, input }) => {
  const parsed = tenantSlugSchema.safeParse(input);

  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "tenantSlug is required.",
    });
  }

  // A cache is a production concern. At demo scale this is one indexed
  // lookup against `tenants_slug_key`, the fastest query in the app.
  const [tenant] = await ctx.db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, parsed.data.tenantSlug))
    .limit(1);

  if (!tenant) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Clinic not found.",
    });
  }

  return next({ ctx: { tenant } });
});

/* ────────────────────────────────────────────────────────────────────────────
   BRANCH 1 — PUBLIC
   Anonymous consumer. May READ a tenant's storefront, categories and products.
   May never write anything.

   This branch is required, not optional. `FEATURES.md` §2 gives consumers no
   account, so hanging tenant resolution only off `isAuthed` would make the
   entire public storefront unreachable.
   ──────────────────────────────────────────────────────────────────────── */
export const publicProcedure = t.procedure.use(requestInfo);

export const publicTenantProcedure = publicProcedure
  .input(tenantSlugSchema)
  .use(resolveTenant);

/* ────────────────────────────────────────────────────────────────────────────
   BRANCH 2 — ADMIN
   Clinic owner. Requires a session AND a membership in the resolved tenant.
   ──────────────────────────────────────────────────────────────────────── */

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }

  /**
   * The throw above is what makes the types non-null HERE, inside this
   * function. Passing only `{ user: ctx.user, session: ctx.session }` — no
   * spread — carries that narrowing forward for every procedure built on
   * `protectedProcedure`.
   */
  return next({ ctx: { user: ctx.user, session: ctx.session } });
});

export const protectedProcedure = publicProcedure.use(isAuthed);

export const tenantProcedure = protectedProcedure
  .input(tenantSlugSchema)
  .use(resolveTenant);

/**
 * Layer 2 of 3. Runs AFTER the tenant is resolved, so a membership for the
 * WRONG tenant is not good enough.
 *
 * `resolveTenant` answers "does this clinic exist?" — a public question.
 * This answers "is THIS user a member of it?" — the private one. Both must
 * pass, and neither substitutes for the other.
 */
const hasRole =
  (...allowedRoles: Array<"owner" | "admin">) =>
  tenantProcedure.use(async ({ ctx, next }) => {
    const [membership] = await ctx.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, ctx.user.id),
          eq(memberships.tenantId, ctx.tenant.id),
        ),
      )
      .limit(1);

    if (!membership) {
      // 403, not 404. The user IS authenticated and the tenant DOES exist —
      // returning 404 here would leak the existence of tenants a user has no
      // business knowing about.
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not belong to this clinic.",
      });
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions.",
      });
    }

    return next({
      ctx: { membership, role: membership.role },
    });
  });

export const adminProcedure = hasRole("owner", "admin");
export const ownerProcedure = hasRole("owner");
