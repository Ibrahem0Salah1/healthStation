import type { Metadata } from "next";

import { CategoryNav } from "@/components/storefront/blocks/category-nav";
import { FeaturedProducts } from "@/components/storefront/blocks/featured-products";
import { StoreHero } from "@/components/storefront/blocks/hero";
import { StoreCta, TrustBadges } from "@/components/storefront/blocks/trust";
import { api } from "@/server/caller";

/**
 * THE STOREFRONT HOME PAGE.
 *
 * Everything here is derived from `config`, and every section can be turned
 * off by the owner without a deploy. That is the thesis of the JSONB config
 * from `FEATURES.md` §4, made visible: two clinics run this exact file and
 * can end up with completely different-looking pages.
 *
 * ── The three independent queries, run in parallel ──────────────────────
 * `Promise.all` rather than three sequential awaits. The product round trip is
 * the slowest of the three, and it has no dependency on the other two — so
 * serialising them pays latency for nothing. This is the single highest-value
 * line on the page.
 *
 * ── The registry ────────────────────────────────────────────────────────
 * The sections below are laid out in a fixed order that is chosen for a
 * consumer's intent: what this clinic is → where to go → what to buy → why
 * trust us → one more action. The *content* of each is tenant-controlled; the
 * *sequence* is the platform's, because a layout that rearranges itself based
 * on which config flags happen to be set is unpredictable.
 *
 * ── REAL DATA NOW ───────────────────────────────────────────────────────
 * All three data sources are in-process tRPC reads against the same routers
 * that serve the browser over HTTP. The tenant layout resolves the clinic
 * once; this page reads the storefront config, the category nav and the
 * featured strip from the same `api()` caller.
 */

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const caller = await api();
    const tenant = await caller.tenant.getBySlug({ tenantSlug });
    return {
      title: `${tenant.name} — ${tenant.config?.hero.headline ?? "Storefront"}`,
    };
  } catch {
    /*
     * The page body re-throws anything that is not a tenant NOT_FOUND, and the
     * layout translates that NOT_FOUND into `notFound()`. `generateMetadata`
     * has no such neighbour — it runs on its own, so a bad slug here MUST
     * degrade to a title rather than bubble up as a 500 beside the layout's
     * clean 404.
     */
    return { title: "Not found" };
  }
}

export default async function StorefrontHomePage({ params }: PageProps) {
  const { tenantSlug } = await params;

  const caller = await api();
  const [tenant, categories, featured] = await Promise.all([
    caller.tenant.getBySlug({ tenantSlug }),
    caller.category.list({ tenantSlug }),
    caller.product.featured({ tenantSlug, limit: 6 }),
  ]);

  /**
   * The layout already 404s for an unknown tenant, so this cannot be null in
   * practice. The guard is here because `generateMetadata` and the page body
   * are independent call sites of the same data function, and a bare `.config`
   * access would be a runtime crash waiting for a change in either.
   */
  if (!tenant || !tenant.config) return null;

  const config = tenant.config;
  const branding = { id: tenant.id, name: tenant.name, slug: tenant.slug };

  return (
    <>
      <StoreHero tenant={branding} config={config} />

      {/*
        `showCategories: false` is the tenant's call, not a check for "are
        there any categories". A clinic with categories that wants a single
        hero-and-CTA page can have one; a clinic with none would see an empty
        strip if we only checked the array. Both conditions are required.
      */}
      {config.showCategories ? <CategoryNav tenant={branding} categories={categories} /> : null}

      {/*
        `FeaturedProducts` returns null on an empty array, so a new clinic
        with no products does not render a heading over nothing.
      */}
      <FeaturedProducts tenant={branding} products={featured} />

      <TrustBadges config={config} />

      <div className="flex-1" />
      <StoreCta tenant={branding} config={config} />
    </>
  );
}