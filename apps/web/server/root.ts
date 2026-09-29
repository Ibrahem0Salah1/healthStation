import { router, publicProcedure, protectedProcedure, adminProcedure } from "./trpc";
import { tenantRouter, storefrontRouter } from "./routers/tenant";
import { categoryRouter } from "./routers/category";
import { productRouter } from "./routers/product";

/**
 * ── BRICK MAP ──────────────────────────────────────────────────────────────
 *   BRICK 1  ✅  tenant.ts      — getBySlug
 *   BRICK 3  ✅  tenant.ts      — storefront get/update
 *   BRICK 4  ✅  category.ts    — list / getBySlug / listForAdmin / create
 *   BRICK 5  ✅  product.ts     — list / featured / detail / listForAdmin /
 *                                 getForAdmin / create / update / setActive
 */

export const appRouter = router({
  /**
   * Liveness + reachability of the database, with no auth. Deliberately
   * leaks nothing beyond `ok`.
   */
  health: publicProcedure.query(({ ctx }) => ({
    status: "ok",
    databaseAvailable: Boolean(ctx.db),
    requestId: ctx.requestId,
  })),

  /** Who am I? Requires a session, no tenant. */
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
  })),

  /**
   * Proof that the middleware chain narrows `ctx` for the TYPE SYSTEM, not
   * just at runtime: `ctx.user` is `User | null` on `protectedProcedure` and
   * non-null here, so TypeScript would reject `ctx.user.id` if the chain were
   * wrong. The compiler is checking the authorization.
   */
  adminCheck: adminProcedure.query(({ ctx }) => ({
    message: "Admin access granted.",
    tenant: ctx.tenant.slug,
    role: ctx.role,
  })),

  tenant: tenantRouter,
  storefront: storefrontRouter,
  category: categoryRouter,
  product: productRouter,
});

/**
 * The API's type, exported for the client.
 *
 * `AppRouter` is what `utils/trpc.ts` builds the typed React client from.
 * That single line is the entire argument for a monorepo: the browser's idea
 * of the API is DERIVED from the server's implementation, so it cannot drift.
 */
export type AppRouter = typeof appRouter;
