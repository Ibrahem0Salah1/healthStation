import type { Membership, Product, Storefront } from "@repo/database";

/**
 * THE VIEW-MODEL LAYER.
 *
 * Why this file exists at all, when the database already exports row types:
 *
 * A Router returns a Drizzle row. A React component should never receive a
 * Drizzle row, for two reasons.
 *
 * 1. LEAKAGE. `products` has `tenantId`. That column is an implementation
 *    detail of storage, and it is the single most sensitive field in this
 *    schema. A component that receives it can be changed to render it, or
 *    filter on it, or send it anywhere. A view-model that does not contain
 *    the field cannot leak it, because there is nothing to leak. This is the
 *    same discipline as a DTO in a distributed system, applied to your own
 *    database.
 *
 * 2. COUPLING. If the component's props are `Pick<Product, ...>`, then
 *    renaming a column breaks the UI. If they are `StorefrontProduct`, only
 *    the router that maps into it changes. The blast radius of a schema
 *    change stops at this file.
 *
 * So: the router is the only place that knows about BOTH the row and the
 * view-model, and it maps between them. Everything above it speaks only the
 * view-model.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️  EDITOR'S NOTE — these are the contracts YOUR routers must return.
 *
 * `app/[tenantSlug]/**` and `app/[tenantSlug]/admin/**` are already typed
 * against these exact shapes. When you write the routers, make each
 * procedure's return value satisfy the matching type here. The compiler
 * will tell you precisely where you diverge.
 *
 * Anything a component does not render should not be in the type. The whole
 * point is that the list is short enough to audit.
 */

export type TenantRole = Membership["role"];

/** What the tenant layout resolves once per navigation. */
export type TenantView = {
  id: string;
  name: string;
  slug: string;
  /** Null only if a storefront row is missing. `config` itself is NOT NULL. */
  config: Storefront["config"] | null;
};

/** Header / footer / admin shell. Deliberately excludes `config`. */
export type TenantBranding = Pick<TenantView, "id" | "name" | "slug">;

/** Category as used in the nav and on the shop filter rail. */
export type CategoryView = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  /**
   * Active-product count, computed by the router in a correlated subquery.
   * Optional because the admin list does not show it — see the N+1 note on
   * `category.list` in the router spec.
   */
  productCount?: number;
};

/**
 * The card/grid shape.
 *
 * Note what is NOT here: `description`, `details`, `isActive`, `sortOrder`,
 * `tenantId`, `updatedAt`. A product grid renders a name, a summary, a price
 * and a thumbnail. Carrying `description` into a component that never reads
 * it is how a 3KB paragraph ends up in a payload for 12 cards.
 */
export type ProductCardView = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
};

/** The product detail page — a superset of the card. */
export type ProductView = ProductCardView & {
  description: string;
  details: Product["details"];
  category: Pick<CategoryView, "id" | "name" | "slug"> | null;
  isActive: boolean;
  sortOrder: number;
};

/** The admin tables need the columns a public page must never see. */
export type ProductAdminView = ProductView;

/** `product.list` returns this, not a bare array — pagination is part of the data. */
export type PaginatedProducts = {
  items: ProductCardView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Raw config, for the admin editor. */
export type StorefrontConfigView = NonNullable<TenantView["config"]>;

/** `adminCheck` in `server/root.ts` — the cross-tenant authorization proof. */
export type AdminCheckView = {
  message: string;
  tenant: string;
  role: TenantRole;
};

/**
 * `RowOf<T>` is a helper for the ROUTERS only.
 *
 * It reads as "the raw row for this view-model" without forcing every router
 * to spell out `typeof products.$inferSelect`. The routers are the single
 * layer allowed to hold both representations; this is the reminder.
 */
export type RowOf<T> = T extends { id: string } ? T : never;
