import { and, asc, eq, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { categories, products, type db as dbType } from "@repo/database";

import { adminProcedure, publicTenantProcedure, router } from "../trpc";
import {
  productCreateInputSchema,
  productDetailInputSchema,
  productFeaturedInputSchema,
  productGetForAdminInputSchema,
  productListInputSchema,
  productSetActiveInputSchema,
  productUpdateInputSchema,
} from "@/lib/product-schema";
import { slugify } from "@/lib/slug";
import type {
  PaginatedProducts,
  ProductCardView,
  ProductView,
} from "@/lib/storefront-types";

type Db = typeof dbType;

/**
 * BRICK 5 - PRODUCTS.
 *
 * Eight procedures, in three tiers, matching what the app genuinely asks:
 *
 *   list                  PUBLIC  the shop grid: paginated, filterable, active only.
 *   featured              PUBLIC  the home-page strip: the first N active products.
 *   detail                PUBLIC  the product page: product + same-category siblings.
 *   listForAdmin          ADMIN   the admin table: every row, with its category.
 *   getForAdmin           ADMIN   the edit screen: one row by id, or null.
 *   create / update       ADMIN   the two writes.
 *   setActive             ADMIN   the visibility toggle (soft delete, one column).
 *
 * THE ONE IDEA THIS BRICK IS ABOUT, AGAIN: UNIQUE SCOPE.
 *
 * `products_tenant_slug_uidx` is a UNIQUE index on `(tenant_id, slug)` — the
 * same composite-scope decision as `categories`, and for the same reason:
 * two clinics must both be able to sell "omega-3". Every read below filters
 * `WHERE tenant_id = ctx.tenant.id`; every write stamps it. The slug from the
 * URL is resolved to a tenant ONCE by middleware, and that resolved id is the
 * only tenant authority — the input schema has no `tenantId` key at all, so a
 * request body cannot name one.
 *
 * ── THE QUERY-SHAPE TRAP, LEARNED IN BRICK 4 ────────────────────────────
 * Drizzle 0.45 renders columns interpolated into `sql` fragments UNQUALIFIED
 * inside correlated subqueries. So there are NO interpolated fragment columns
 * in this file — the only fragments are `count(*)::int` and
 * `coalesce(max(...)) + 1`, which interpolate only table-column objects handed
 * to Drizzle as expressions (those are qualified correctly when a query has a
 * join). See `category.ts` for the full autopsy.
 *
 * ── THE CATEGORY JOIN IS TENANT-SCOPED ────────────────────────────────
 * `products.category_id` is a plain FK: it proves a category row exists
 * somewhere, not that it is this clinic's. The `on` clause below therefore
 * also requires `categories.tenant_id = products.tenant_id`. That makes a
 * corrupt cross-tenant reference render as "uncategorised" instead of leaking
 * another clinic's category name into this one's admin table, and it is what
 * makes the category filter in `list` tenant-safe without a second predicate.
 */

/**
 * The card shape — the columns a grid renders. Selecting only these is what
 * keeps the shop page payload lean; Drizzle projects exactly the listed
 * columns, not the whole row.
 */
const cardColumns = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  summary: products.summary,
  priceCents: products.priceCents,
  currency: products.currency,
  imageUrl: products.imageUrl,
};

/** The detail/admin shape: the card columns plus what only those pages read. */
const viewColumns = {
  ...cardColumns,
  description: products.description,
  details: products.details,
  isActive: products.isActive,
  sortOrder: products.sortOrder,
};

/**
 * The full joined shape for admin/list/detail reads.
 *
 * `category` is selected as a nested object (Drizzle's join projection) so the
 * row arrives with a single `row.category` object. After a LEFT JOIN the
 * columns are individually nullable; `toProductView` narrows that to `null`.
 */
const fullColumns = {
  ...viewColumns,
  category: {
    id: categories.id,
    name: categories.name,
    slug: categories.slug,
  },
};

type JCategory = { id: string | null; name: string | null; slug: string | null };

/**
 * Maps a joined row to the view-model.
 *
 * `Omit<ProductView, "category">` is exactly the flat column set, so any drift
 * between the select and the contract fails to compile here.
 */
function toProductView(
  row: Omit<ProductView, "category"> & { category: JCategory | null },
): ProductView {
  /*
   * Drizzle's LEFT JOIN projects `category` as an object of nullable fields —
   * and the OBJECT ITSELF is `| null`. Both layers are narrowed here.
   */
  const category =
    row.category &&
    row.category.id !== null &&
    row.category.name !== null &&
    row.category.slug !== null
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
      : null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    imageUrl: row.imageUrl,
    details: row.details,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    category,
  };
}

/**
 * The tenant-scoped join condition, used by every joined read.
 *
 * `and(...)` with two conditions, so `category_id` and `tenant_id` must BOTH
 * match the product's row — a cross-tenant category reference contributes a
 * NULL category, never a foreign name.
 */
function categoryJoin(tenantId: string) {
  return and(
    eq(categories.tenantId, tenantId),
    eq(products.categoryId, categories.id),
  );
}

/**
 * One row, joined, scoped. Shared by `getForAdmin`, `create`, `update` and
 * `setActive` so the "what the admin sees after a write" shape lives in one
 * place rather than four slightly drfited copies.
 */
async function loadJoinedProduct(
  db: Db,
  tenantId: string,
  productId: string,
) {
  const [row] = await db
    .select(fullColumns)
    .from(products)
    .leftJoin(categories, categoryJoin(tenantId))
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .limit(1);

  return row;
}

export const productRouter = router({
  /* ────────────────────────────────────────────────
   * THE SHOP — public reads
   * ──────────────────────────────────────────────── */

  /**
   * THE SHOP GRID — the hottest read in the app, and the one
   * `products_tenant_active_idx` exists for.
   *
   * TWO queries, not a window function: a `count(*)` and the page itself.
   * The page comment in this file's `category.ts` cousin endorses a separate
   * COUNT as "the other correct option"; going with it here keeps the two
   * queries trivially auditable and returns pagination that always agrees
   * with the mock layer's semantics (page clamped into a sane range).
   *
   * A `categorySlug` filters by the JOINED category's slug, scoped by the
   * join condition — so `?category=vitamins` yields exactly THIS clinic's
   * vitamins or zero rows, never another clinic's accidentally-matching slug.
   */
  list: publicTenantProcedure
    .input(productListInputSchema)
    .query(async ({ ctx, input }): Promise<PaginatedProducts> => {
      const conditions = [
        eq(products.tenantId, ctx.tenant.id),
        eq(products.isActive, true),
      ];

      if (input.categorySlug) {
        conditions.push(eq(categories.slug, input.categorySlug));
      }

      const [countRow] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(products)
        .leftJoin(categories, categoryJoin(ctx.tenant.id))
        .where(and(...conditions));

      const total = countRow?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
      /*
       * `count(*)` returns `bigint` → string in Node. The `::int` cast above
       * is load-bearing: without it `total` would be `"3"` and `===` checks
       * would silently fail. Same cast, same failure mode, as `category.ts`.
       */
      const page = Math.min(Math.max(1, input.page), totalPages);

      const items = await ctx.db
        .select(cardColumns)
        .from(products)
        .leftJoin(categories, categoryJoin(ctx.tenant.id))
        .where(and(...conditions))
        /*
         * sortOrder first — the owner's arrangement wins. The name tiebreak
         * keeps the order stable across identical requests, since two rows can
         * share a sortOrder.
         */
        .orderBy(asc(products.sortOrder), asc(products.name))
        .limit(input.pageSize)
        .offset((page - 1) * input.pageSize);

      return { items, total, page, pageSize: input.pageSize, totalPages };
    }),

  /** THE HOME STRIP. Active only; the owner hides products, the strip follows. */
  featured: publicTenantProcedure
    .input(productFeaturedInputSchema)
    .query(async ({ ctx, input }): Promise<ProductCardView[]> => {
      return ctx.db
        .select(cardColumns)
        .from(products)
        .where(
          and(
            eq(products.tenantId, ctx.tenant.id),
            eq(products.isActive, true),
          ),
        )
        .orderBy(asc(products.sortOrder), asc(products.name))
        .limit(input.limit);
    }),

  /**
   * THE PRODUCT PAGE — one call, two shapes.
   *
   * Returns `{ product, related }` in a single procedure. The product and its
   * siblings share a snapshot, so a slug swap between two calls cannot render
   * a page whose "more in this category" contradicts its own hero.
   *
   * An INACTIVE product is NOT_FOUND, not `isActive: false`. The owner hid it;
   * a direct URL must not resurrect it. Hiding via soft-delete cannot be
   * undone by a deep link.
   */
  detail: publicTenantProcedure
    .input(productDetailInputSchema)
    .query(
      async ({
        ctx,
        input,
      }): Promise<{ product: ProductView; related: ProductCardView[] }> => {
        const [row] = await ctx.db
          .select(fullColumns)
          .from(products)
          .leftJoin(categories, categoryJoin(ctx.tenant.id))
          .where(
            and(
              eq(products.tenantId, ctx.tenant.id),
              eq(products.slug, input.productSlug),
              eq(products.isActive, true),
            ),
          )
          .limit(1);

        if (!row) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
        }

        const relatedConditions = [
          eq(products.tenantId, ctx.tenant.id),
          eq(products.isActive, true),
          ne(products.id, row.id),
        ];

        /*
         * Siblings are "same category when the product has one; else same
         * clinic". The `if` mirrors the mock's `listProducts` quite deliberate:
         * an uncategorised product's page says "More in this clinic", so its
         * "related" must not be an empty grid.
         */
        if (row.category?.id) {
          relatedConditions.push(eq(products.categoryId, row.category.id));
        }

        const related = await ctx.db
          .select(cardColumns)
          .from(products)
          .where(and(...relatedConditions))
          .orderBy(asc(products.sortOrder), asc(products.name))
          .limit(4);

        return { product: toProductView(row), related };
      },
    ),

  /* ────────────────────────────────────────────────
   * THE ADMIN — authenticated reads
   * ──────────────────────────────────────────────── */

  /**
   * THE ADMIN TABLE. Every product, active or not — the whole point of the
   * table is that it shows what the storefront hides. Also the ONE place that
   * carries the nullable category into the view, because the table renders the
   * category relationship and the shop cannot (cards are category-blind).
   */
  listForAdmin: adminProcedure.query(
    async ({ ctx }): Promise<ProductView[]> => {
      const rows = await ctx.db
        .select(fullColumns)
        .from(products)
        .leftJoin(categories, categoryJoin(ctx.tenant.id))
        .where(eq(products.tenantId, ctx.tenant.id))
        .orderBy(asc(products.sortOrder), asc(products.name));

      return rows.map(toProductView);
    },
  ),

  /**
   * THE EDIT SCREEN. Returns NULL for a miss (the page turns null into
   * `notFound()`), NOT a throw — a missing id is an expected outcome an
   * interactive route must react to, not an exception an RSC boundary must
   * catch. The contrast with `detail` is deliberate: that procedure's
   * NOT_FOUND crosses a browser HTTP boundary and so must be a code; this one
   * speaks to a page that already knows how to handle a null.
   */
  getForAdmin: adminProcedure
    .input(productGetForAdminInputSchema)
    .query(async ({ ctx, input }): Promise<ProductView | null> => {
      const row = await loadJoinedProduct(ctx.db, ctx.tenant.id, input.productId);
      return row ? toProductView(row) : null;
    }),

  /* ────────────────────────────────────────────────
   * THE WRITES — admin only
   * ──────────────────────────────────────────────── */

  /**
   * THE WRITE. Three server decisions the client does not make:
   *
   *   1. WHICH CLINIC   — `ctx.tenant.id`, never input
   *   2. WHAT POSITION  — appended, `max() + 1`
   *   3. WHICH CATEGORY — validated to BE in this clinic (see below)
   */
  create: adminProcedure
    .input(productCreateInputSchema)
    .mutation(async ({ ctx, input }): Promise<ProductView> => {
      const slug = input.slug ?? slugify(input.name);

      /* A name of "..." or a CJK-only string slugifies to "". The column is
       * NOT NULL — without this check the insert dies as a raw Postgres
       * not-null 500. A 400 with a human explanation is the same rejection,
       * made usable. */
      if (!slug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That name has no letters or numbers a URL can use. Add a URL slug.",
        });
      }

      /*
       * CATEGORY OWNERSHIP — the FK is not enough.
       *
       * `products.category_id` references `categories.id` alone. That proves
       * the category exists, not that the tenant owns it. A hand-crafted
       * request could file a product under another clinic's category and the
       * database would accept it. This check makes cross-tenant categorisation
       * impossible rather than merely unwise. Returns NOT_FOUND: the category
       * is real but not in THIS clinic, and the form only ever lists this
       * clinic's categories, so a miss means a stale client, not a typo.
       */
      if (input.categoryId) {
        const [category] = await ctx.db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.tenantId, ctx.tenant.id),
              eq(categories.id, input.categoryId),
            ),
          )
          .limit(1);

        if (!category) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This category does not exist in your clinic.",
          });
        }
      }

      /*
       * THE FRIENDLY COLLISION CHECK. Scoped to this tenant, so it only fires
       * on a genuine in-clinic duplicate — and two clinics may both sell
       * "omega-3" because the index is composite. This is for a READABLE error;
       * the guarantee is the unique index, handled below.
       */
      const [clash] = await ctx.db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(
          and(
            eq(products.tenantId, ctx.tenant.id),
            eq(products.slug, slug),
          ),
        )
        .limit(1);

      if (clash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `The URL "${slug}" is already used by "${clash.name}". Pick a different slug, or change the name.`,
        });
      }

      /* THE POSITION, CHOSEN BY THE SERVER. Appended after the current max.
       * Same `coalesce(..., -1) + 1` reasoning as `category.create`: an empty
       * tenant must start at 0, and a `max(integer)` already stays integer. */
      const [{ nextOrder }] = await ctx.db
        .select({
          nextOrder: sql<number>`coalesce(max(${products.sortOrder}), -1) + 1`,
        })
        .from(products)
        .where(eq(products.tenantId, ctx.tenant.id));

      let inserted;
      try {
        [inserted] = await ctx.db
          .insert(products)
          .values({
            tenantId: ctx.tenant.id,
            categoryId: input.categoryId,
            name: input.name,
            slug,
            summary: input.summary,
            description: input.description,
            priceCents: input.priceCents,
            /* No currency field in the input: the app is single-currency and
             * seeding is `"USD"`. A request body cannot name one. */
            currency: "USD",
            imageUrl: input.imageUrl,
            details: input.details,
            isActive: input.isActive,
            sortOrder: nextOrder,
          })
          .returning({ id: products.id });
      } catch (error) {
        /* `23505` is Postgres' unique_violation — the race-safe backstop that
         * converts two simultaneous creates past the friendly check into the
         * same clean 409. Anything else is re-thrown untouched: swallowing a
         * genuine outage into a "duplicate slug" message hides the real bug. */
        if ((error as { code?: string }).code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The URL "${slug}" was just created by someone else. Pick a different slug.`,
          });
        }
        throw error;
      }

      if (!inserted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The product was not created. Try again.",
        });
      }

      const row = await loadJoinedProduct(ctx.db, ctx.tenant.id, inserted.id);
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The product was created but could not be read back.",
        });
      }

      return toProductView(row);
    }),

  /**
   * THE EDIT. Requires the immutable `productId`, scoped to this tenant, and
   * re-runs the two CREATE checks (category ownership, slug collision) because
   * an edit can change either. The slug collision check is skipped only when
   * the slug did not change — otherwise saving a product without touching its
   * slug would collide with ITSELF.
   */
  update: adminProcedure
    .input(productUpdateInputSchema)
    .mutation(async ({ ctx, input }): Promise<ProductView> => {
      const [existing] = await ctx.db
        .select({ id: products.id, slug: products.slug })
        .from(products)
        .where(
          and(
            eq(products.tenantId, ctx.tenant.id),
            eq(products.id, input.productId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found.",
        });
      }

      const slug = input.slug ?? slugify(input.name);

      if (!slug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That name has no letters or numbers a URL can use. Add a URL slug.",
        });
      }

      if (input.categoryId) {
        const [category] = await ctx.db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.tenantId, ctx.tenant.id),
              eq(categories.id, input.categoryId),
            ),
          )
          .limit(1);

        if (!category) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This category does not exist in your clinic.",
          });
        }
      }

      if (slug !== existing.slug) {
        const [clash] = await ctx.db
          .select({ id: products.id, name: products.name })
          .from(products)
          .where(
            and(
              eq(products.tenantId, ctx.tenant.id),
              eq(products.slug, slug),
            ),
          )
          .limit(1);

        if (clash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The URL "${slug}" is already used by "${clash.name}". Pick a different slug.`,
          });
        }
      }

      const [updated] = await ctx.db
        .update(products)
        .set({
          categoryId: input.categoryId,
          name: input.name,
          slug,
          summary: input.summary,
          description: input.description,
          priceCents: input.priceCents,
          currency: "USD",
          imageUrl: input.imageUrl,
          details: input.details,
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.tenantId, ctx.tenant.id),
            eq(products.id, input.productId),
          ),
        )
        .returning({ id: products.id });

      /* A concurrent `setActive`/delete could remove the row mid-edit. That is
       * a genuine NOT_FOUND, not the corruption 500 that `create` guards. */
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found.",
        });
      }

      const row = await loadJoinedProduct(ctx.db, ctx.tenant.id, updated.id);
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The product was updated but could not be read back.",
        });
      }

      return toProductView(row);
    }),

  /**
   * THE VISIBILITY TOGGLE — the entire soft-delete story in one column.
   *
   * No product is ever destroyed: `orders` may reference it, and history is
   * history. `isActive` flips the storefront on and off; the admin table keeps
   * showing it in both states, which is exactly what makes "hidden" inspectable.
   */
  setActive: adminProcedure
    .input(productSetActiveInputSchema)
    .mutation(async ({ ctx, input }): Promise<ProductView> => {
      const [updated] = await ctx.db
        .update(products)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(
          and(
            eq(products.tenantId, ctx.tenant.id),
            eq(products.id, input.productId),
          ),
        )
        .returning({ id: products.id });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found.",
        });
      }

      const row = await loadJoinedProduct(ctx.db, ctx.tenant.id, updated.id);
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The product was updated but could not be read back.",
        });
      }

      return toProductView(row);
    }),
});