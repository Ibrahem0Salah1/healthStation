import { and, asc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { categories, products } from "@repo/database";

import { adminProcedure, publicTenantProcedure, router } from "../trpc";
import {
  categoryCreateInputSchema,
  categoryGetBySlugInputSchema,
  slugify,
} from "@/lib/category-schema";
import type { CategoryView } from "@/lib/storefront-types";

/**
 * BRICK 4 - CATEGORIES.
 *
 * Three procedures, because the app genuinely asks three different questions
 * about categories, at different costs and to different audiences:
 *
 *   list          PUBLIC   the storefront nav. Cheap: id, name, slug, order.
 *   listForAdmin  ADMIN   the admin table. Adds a product count per row.
 *   create        ADMIN   the only write.
 *
 * THE ONE IDEA THIS BRICK IS ABOUT: UNIQUE SCOPE.
 *
 * `categories_tenant_slug_uidx` is a UNIQUE index on `(tenant_id, slug)` -
 * composite, not global.
 *
 * The single-tenant tutorial writes `slug: text("slug").unique()`. Copying
 * that into a multi-tenant schema is one of the most common and most damaging
 * mistakes in this whole category of app, because it looks correct and fails
 * open:
 *
 *   Clinic A creates "Pain Relief"   -> fine
 *   Clinic B creates "Pain Relief"   -> 500, "duplicate key value"
 *
 * Two unrelated pharmacies cannot both have a "Pain Relief" category, and
 * there is no user-facing way to explain that to either owner. Worse, the
 * error message leaks the existence of a competitor's category.
 *
 * The composite index says the right thing: slugs are unique PER CLINIC. So
 * every read AND every write below filters on `tenant_id = ctx.tenant.id`,
 * including the collision check - which is what makes "Cairo Heart" and
 * "Alexandria Pediatrics" both free to own a category called "Vitamins".
 *
 * WHY EVERY PROCEDURE FILTERS BY `ctx.tenant.id` AND NOT THE RAW SLUG:
 *
 * `ctx.tenant` was resolved by middleware from the slug, and it is the only
 * value proven to exist. The raw string from the request never reaches a
 * WHERE clause. If a future refactor "simplified" one of these to
 * `eq(categories.tenantId, input.tenantId)`, the build would stop, because
 * `tenantId` is not in the input at all - which is the point of leaving it out.
 */

/**
 * The columns every category view needs. One place, so the three cannot drift.
 *
 * ── WHY `listForAdmin` IS A JOIN AND NOT A CORRELATED SUBQUERY ──────────
 *
 * The obvious way to add a per-category product count is a correlated
 * subquery:
 *
 *     select count(*)::int from products where products.category_id = categories.id
 *
 * In drizzle-orm 0.45 that query is a SILENT, wrong-count trap. Columns
 * interpolated into a `sql` fragment are rendered UNQUALIFIED - `"id"`,
 * `"category_id"` - so inside the subquery both names resolve against the
 * subquery's own FROM (`products`). The predicate becomes
 * `products.category_id = products.id`, which is never true, and every count
 * returns 0 with no error. It typechecks, it looks right, the comment says it
 * works - and the admin table shows an empty badge for every category.
 *
 * A JOIN query gets the columns qualified correctly (Drizzle qualifies
 * fragment columns when the query has a join), so the count below is a
 * `LEFT JOIN` + `GROUP BY`. That is not a kindness to style: it is the version
 * that produces the SQL the comment claims to write.
 */
const viewColumns = {
  id: categories.id,
  name: categories.name,
  slug: categories.slug,
  sortOrder: categories.sortOrder,
};

/**
 * `count(*)` in PostgreSQL returns `bigint`, which arrives in Node as a
 * STRING. Left uncorrected, `productCount` would be `"3"`, so
 * `count === 3` would be false and the admin table would render a blank badge
 * for every single-product category.
 *
 * `::int` is what makes the declared `sql<number>` true. This cast is
 * load-bearing, not decoration.
 */
const activeProductCount = sql<number>`count(${products.id})::int`;

export const categoryRouter = router({
  list: publicTenantProcedure.query(async ({ ctx }): Promise<CategoryView[]> => {
    return ctx.db
      .select(viewColumns)
      .from(categories)
      .where(eq(categories.tenantId, ctx.tenant.id))
      /*
       * `sortOrder` ASC first - that is the owner's explicit arrangement and
       * must win. The `name` tiebreak is not cosmetic: `sortOrder` is not
       * UNIQUE (see the honest caveat in `create`), so two categories can
       * legitimately share a position, and without a tiebreak Postgres may
       * return them in either order between two identical requests - which
       * would make the nav reshuffle on refresh.
       */
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }),
  getBySlug: publicTenantProcedure
    .input(categoryGetBySlugInputSchema)
    .query(async ({ ctx, input }): Promise<CategoryView | null> => {
      const [row] = await ctx.db
        .select(viewColumns)
        .from(categories)
        .where(
          and(
            eq(categories.tenantId, ctx.tenant.id),
            eq(categories.slug, input.categorySlug),
          ),
        )
        .limit(1);

      return row ?? null;
    }),
  listForAdmin: adminProcedure.query(
    async ({ ctx }): Promise<CategoryView[]> => {
      return ctx.db
        .select({ ...viewColumns, productCount: activeProductCount })
        .from(categories)
        .leftJoin(
          products,
          and(
            eq(products.categoryId, categories.id),
            eq(products.isActive, true),
          ),
        )
        .where(eq(categories.tenantId, ctx.tenant.id))
        .groupBy(categories.id)
        .orderBy(asc(categories.sortOrder), asc(categories.name));
    },
  ),

  create: adminProcedure
    .input(categoryCreateInputSchema)
    .mutation(async ({ ctx, input }): Promise<CategoryView> => {
      /*
       * A blank slug means "derive it". `slugify` also re-normalises a
       * hand-typed one, so `Heart--Health` and `  heart health  ` both land
       * as `heart-health` rather than creating two near-identical categories.
       */
      const slug = input.slug ? input.slug : slugify(input.name);

      /*
       * A name made entirely of characters that slugify away - "..." or an
       * all-CJK string - produces an EMPTY slug. `categories.slug` is
       * NOT NULL, so without this the insert fails with a raw Postgres
       * not-null violation the owner sees as an unactionable 500. A 400 with a
       * human-readable reason is the same rejection, made usable.
       */
      if (!slug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That name has no letters or numbers a URL can use. Add a URL slug.",
        });
      }
      const [clash] = await ctx.db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(
          and(
            eq(categories.tenantId, ctx.tenant.id),
            eq(categories.slug, slug),
          ),
        )
        .limit(1);

      if (clash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `The URL "${slug}" is already used by "${clash.name}". Pick a different slug, or change the name.`,
        });
      }
      const [{ nextOrder }] = await ctx.db
        .select({
          nextOrder: sql<number>`coalesce(max(${categories.sortOrder}), -1) + 1`,
        })
        .from(categories)
        .where(eq(categories.tenantId, ctx.tenant.id));

      /*
       * STEP 3 - THE INSERT.
       *
       * `tenantId: ctx.tenant.id` is the line that makes a cross-tenant write
       * structurally impossible. A client that posts `tenantId: "<other id>"`
       * is not merely rejected - the key does not exist in the input schema, so
       * `.strict()` returns a 400 naming the offending field before any SQL
       * runs.
       */
      let inserted;
      try {
        [inserted] = await ctx.db
          .insert(categories)
          .values({
            tenantId: ctx.tenant.id,
            name: input.name,
            slug,
            sortOrder: nextOrder,
          })
          .returning(viewColumns);
      } catch (error) {
        /*
         * THE RACE-SAFE BACKSTOP.
         *
         * `23505` is PostgreSQL's `unique_violation`. If two creates race past
         * the check in step 1, the database refuses the loser here, and this
         * converts a raw driver error - which would surface as a 500 carrying a
         * Postgres message - into the same clean 409 as the friendly path.
         *
         * Any other error is re-thrown untouched. Swallowing everything into a
         * "duplicate slug" message would hide a genuine outage behind a
         * misleading error, which is worse than the 500.
         */
        if ((error as { code?: string }).code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The URL "${slug}" was just created by someone else. Pick a different slug.`,
          });
        }
        throw error;
      }

      return {
        ...inserted,
        /*
         * A brand-new category has no products, so the count is a known 0 -
         * computed here rather than re-queried. Returning the created row in
         * the same shape as `listForAdmin` lets the client drop it straight
         * into the cached list without a refetch.
         */
        productCount: 0,
      };
    }),
});
