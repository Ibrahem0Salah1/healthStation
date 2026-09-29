import type { Metadata } from "next";

import { ProductGrid } from "@/components/storefront/blocks/featured-products";
import { Pagination, ShopFilters } from "@/components/storefront/shop-controls";
import { api } from "@/server/caller";

/**
 * THE SHOP — the hottest read path in the product.
 *
 * This is the page the composite index `products_tenant_active_idx` on
 * `(tenant_id, is_active)` exists for, and the one that most justifies
 * pagination. It is also where an N+1 is easiest to introduce by accident, so
 * the query shape is worth stating: TWO queries for the product page (count +
 * page — see `product.list`), ONE for the tenant, ONE for the category nav,
 * plus the ONE extra category lookup that titles the page. A constant number
 * of round trips, regardless of how many products come back.
 *
 * ── `searchParams` is also a Promise in Next 16 ────────────────────────
 * Same rule as `params`. The types on `PageProps` below are the contract; if
 * you forget to await, TypeScript will not catch it here because it is typed
 * as a Promise, and you will get a runtime error on the first filter click.
 */

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const caller = await api();
    const tenant = await caller.tenant.getBySlug({ tenantSlug });
    return { title: `Shop — ${tenant.name}` };
  } catch {
    return { title: "Not found" };
  }
}

export default async function ShopPage({ params, searchParams }: PageProps) {
  const [{ tenantSlug }, query] = await Promise.all([params, searchParams]);

  const categorySlug = query.category;
  const page = Number(query.page ?? "1") || 1;

  const caller = await api();
  const [tenant, categories, result] = await Promise.all([
    caller.tenant.getBySlug({ tenantSlug }),
    caller.category.list({ tenantSlug }),
    /*
     * The category is resolved INSIDE `product.list`, not by a separate
     * lookup here.
     *
     * Two reasons, and the second is the one that matters:
     *
     * 1. If `category` does not exist, the filter must yield ZERO results,
     *    not every product. A separate `getCategoryBySlug` that returns null
     *    and is then ignored would quietly show the unfiltered catalog —
     *    i.e. a URL that claims to be filtered is not.
     *
     * 2. The tenant predicate stays in exactly one place. The router's
     *    category join is tenant-scoped, so the filter cannot accidentally
     *    match another clinic's identically-named category.
     */
    caller.product.list({ tenantSlug, page, categorySlug }),
  ]);

  if (!tenant) return null;

  const activeCategory = categorySlug
    ? await caller.category.getBySlug({ tenantSlug, categorySlug })
    : null;
  const branding = { id: tenant.id, name: tenant.name, slug: tenant.slug };

  return (
    <div className="px-6 md:px-10 mx-auto max-w-[1400px] py-10 md:py-14 flex-1">
      <header className="mb-8">
        <h1 className="text-[28px] md:text-[36px] font-medium tracking-[-0.03em] text-foreground">
          {activeCategory ? activeCategory.name : "All products"}
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {/*
            `total` comes from the same procedure as `items` — `product.list`
            returns `{ items, total, ... }`, so the page and the count cannot
            disagree. The router computes them from one `count(*)` + one page
            query; it never counts in JavaScript.
          */}
          {result.total} {result.total === 1 ? "product" : "products"}
          {activeCategory ? ` in ${activeCategory.name}` : ""}
        </p>
      </header>

      {/*
        `ShopFilters` and `Pagination` are client components. They are the
        only reason this page is interactive, and they are deliberately
        split out so the grid above and below them stays a Server Component.
        Wrapping the whole page in "use client" to get these two controls
        would ship the entire product list to the browser to re-render it.
      */}
      <ShopFilters categories={categories} />

      <ProductGrid
        tenant={branding}
        products={result.items}
        emptyMessage={
          activeCategory
            ? `No products in ${activeCategory.name} yet.`
            : "This clinic has not listed any products yet."
        }
      />

      <Pagination page={result.page} totalPages={result.totalPages} />
    </div>
  );
}