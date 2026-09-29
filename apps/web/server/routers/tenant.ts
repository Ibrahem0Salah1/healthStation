import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { memberships, storefronts } from "@repo/database";

import { adminProcedure, publicTenantProcedure, router } from "../trpc";
import { storefrontUpdateInputSchema } from "@/lib/storefront-schema";
import type { StorefrontConfigView, TenantView } from "@/lib/storefront-types";

export const tenantRouter = router({
  /**
   * The tenant layout and the storefront editor both read through this.
   *
   * It returns the RAW config, not the `TenantBranding` subset, because the
   * editor needs every field. `--tenant-primary` is derived from it on the
   * server, so a saved colour reaches the public pages without a client fetch.
   */
  getBySlug: publicTenantProcedure.query(
    async ({ ctx }): Promise<TenantView> => {
      const [row] = await ctx.db
        .select({ config: storefronts.config })
        .from(storefronts)
        .where(eq(storefronts.tenantId, ctx.tenant.id))
        .limit(1);

      return {
        id: ctx.tenant.id,
        name: ctx.tenant.name,
        slug: ctx.tenant.slug,
        config: row?.config ?? null,
      };
    },
  ),

  /**
   * "What role does the CURRENT caller hold in THIS tenant?"
   *
   * This is the real replacement for the mock layer's `getCurrentRole`, used
   * by the public layout to decide whether the "Admin" link is shown.
   *
   * ── PUBLIC procedure, on purpose ──
   * It must not 401 an anonymous visitor: `FEATURES.md` §2 gives consumers no
   * account, and the layout runs for EVERY page load. So this is
   * `publicTenantProcedure` — `ctx.user` is `User | null` — and a missing
   * session simply reads as `null`, i.e. "no role, no Admin link".
   *
   * ── But is that a security hole? ──────────────────────────────────────
   * No, and it is the distinction that matters. An authenticated caller can
   * only ever learn their OWN role, never anyone else's: the lookup is
   * `WHERE tenantId = <resolved> AND userId = ctx.user.id`. What you learn
   * about yourself is not a leak, and the tenant itself is public data. The
   * AUTHORITY to WRITE is still enforced separately by `adminProcedure`,
   * which re-runs this exact membership check and throws 403 when it fails.
   * Reading your own role grants nothing that a 403-then-role-check could
   * bypass.
   */
  meRole: publicTenantProcedure.query(
    async ({ ctx }): Promise<"owner" | "admin" | null> => {
      if (!ctx.user) return null;

      const [membership] = await ctx.db
        .select({ role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, ctx.user.id),
            eq(memberships.tenantId, ctx.tenant.id),
          ),
        )
        .limit(1);

      return membership?.role ?? null;
    },
  ),
});

export const storefrontRouter = router({
  /**
   * `publicTenantProcedure`, NOT `adminProcedure`.
   *
   * The storefront config is PUBLIC DATA — it is already rendered in full for
   * anonymous visitors on the public site. Gating this read would protect
   * nothing and would stop the storefront from reading its own theme.
   * Only the WRITE needs a role.
   */
  get: publicTenantProcedure.query(
    async ({ ctx }): Promise<StorefrontConfigView> => {
      const [row] = await ctx.db
        .select({ config: storefronts.config })
        .from(storefronts)
        .where(eq(storefronts.tenantId, ctx.tenant.id))
        .limit(1);

      /**
       * Unreachable in practice: signup inserts this row in the same
       * transaction as the tenant. We THROW rather than substitute a default,
       * because a tenant with no config is broken data, and default copy would
       * hide the bug behind a page that looks like it works.
       */
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This clinic has no storefront configuration.",
        });
      }

      return row.config;
    },
  ),

  /**
   * THE MUTATION — the first write in the app.
   *
   * `adminProcedure` = `isAuthed` → `resolveTenant` → `hasRole("owner","admin")`.
   * The input is the shared schema, so the rules that protect the `style`
   * attribute and the `href` are enforced HERE, on the server, for every
   * request — including one that never touched the React form.
   *
   * The client NEVER sends a tenantId. The row written is derived from
   * `ctx.tenant.id`, resolved by the middleware from the slug in the URL.
   * That is what makes a cross-tenant write structurally impossible rather
   * than merely checked.
   */
  update: adminProcedure
    .input(storefrontUpdateInputSchema)
    .mutation(
      async ({ ctx, input }): Promise<StorefrontConfigView> => {
        /**
         * No `.limit(1)`: PostgreSQL's UPDATE has no LIMIT clause and Drizzle
         * would emit invalid SQL. The `WHERE` on the UNIQUE `tenantId` column
         * already matches at most one row, and `.returning()` tells us what
         * actually changed.
         */
        const [row] = await ctx.db
          .update(storefronts)
          .set({ config: input.config, updatedAt: new Date() })
          .where(eq(storefronts.tenantId, ctx.tenant.id))
          .returning({ config: storefronts.config });

        /**
         * `INTERNAL_SERVER_ERROR`, not NOT_FOUND. Signup creates this row in the
         * same transaction as the tenant, so an empty result means the data is
         * corrupt, not that the clinic is missing. Returning a default config
         * would paper over the corruption.
         */
        if (!row) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "This clinic has no storefront configuration.",
          });
        }

        return row.config;
      },
    ),
});
