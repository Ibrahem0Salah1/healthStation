import { relations } from "drizzle-orm";
import {
  categories,
  memberships,
  products,
  sessions,
  storefronts,
  tenants,
  users,
} from "./schema";

/* ────────────────────────────────────────────────────────────────────────────
   WHY A SEPARATE FILE
   schema.ts      -> DDL. Columns, constraints, indexes. drizzle-kit reads it.
   relations.ts   -> runtime type mapping. NO SQL. Nothing at DDL time.

   Keeping them apart means drizzle-kit never loads db.ts, so starting the
   CLI never opens a database connection or throws on a missing DATABASE_URL.
   ──────────────────────────────────────────────────────────────────────── */

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  /**
   * one() needs explicit fields/references.
   * Why the asymmetry with many()? Drizzle can infer a MANY side by
   * scanning the other table for a foreign key that points here — there's
   * exactly one candidate. For a ONE side the info isn't in this table at
   * all: tenants has no idea storefronts.tenantId exists. So you say it.
   */
  storefront: one(storefronts, {
    fields: [tenants.id],
    references: [storefronts.tenantId],
  }),

  /** many() with no fields: Drizzle finds categories.tenant_id -> tenants.id itself. */
  categories: many(categories),
  products: many(products),
  memberships: many(memberships),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  sessions : many(sessions)
}));
export const sessionsRelations = relations(
  sessions,
  ({ one }) => ({
    user: one(users, {
      fields: [sessions.userId],
      references: [users.id],
    }),
  }),
);
/**
 * The join table. Both sides are ONE, because a membership row points at
 * exactly one user and exactly one tenant.
 */
export const membershipsRelations = relations(
  memberships,
  ({ one }) => ({
    user: one(users, {
      fields: [memberships.userId],
      references: [users.id],
    }),
    tenant: one(tenants, {
      fields: [memberships.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const storefrontsRelations = relations(
  storefronts,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [storefronts.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const categoriesRelations = relations(
  categories,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [categories.tenantId],
      references: [tenants.id],
    }),
    products: many(products),
  }),
);

export const productsRelations = relations(products, ({ one }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),

  /**
   * THE NULLABILITY PAYOFF.
   *
   * We made categoryId nullable in 2.2 so uncategorized products are
   * representable. Drizzle infers that from the column, so
   *   db.query.products.findMany({ with: { category: true } })
   * types the result as `category: Category | null`.
   *
   * The schema decision and the type you get are the same fact, expressed
   * twice — once in Postgres, once in TypeScript. A non-null categoryId
   * would have lied about the data model and forced you to model a
   * "catch-all" category that exists only to satisfy a NOT NULL.
   */
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));