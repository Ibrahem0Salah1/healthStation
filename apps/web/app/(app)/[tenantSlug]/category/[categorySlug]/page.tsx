import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ProductGrid } from "@/components/storefront/blocks/featured-products";
import { api } from "@/server/caller";

type PageProps = {
  params: Promise<{ tenantSlug: string; categorySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug, categorySlug } = await params;

  try {
    const caller = await api();
    const [tenant, category] = await Promise.all([
      caller.tenant.getBySlug({ tenantSlug }),
      caller.category.getBySlug({ tenantSlug, categorySlug }),
    ]);

    if (!category) return { title: "Not found" };

    return {
      title: `${category.name} — ${tenant?.name ?? "Storefront"}`,
      description: `Browse ${category.name} from ${tenant?.name ?? "this clinic"}.`,
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { tenantSlug, categorySlug } = await params;

  const caller = await api();
  const [tenant, category, result] = await Promise.all([
    caller.tenant.getBySlug({ tenantSlug }),
    caller.category.getBySlug({ tenantSlug, categorySlug }),
    /*
     * Fetched in parallel with the category lookup rather than after it, so
     * the two queries overlap. The only cost of doing this before we know the
     * category exists is one wasted query on a bad URL — which is rare and
     * cheap, and the alternative is serialising two round trips on every
     * good URL.
     *
     * `tenantSlug` is passed, never `category.id`. The router resolves the
     * category inside its tenant scope (composite `(tenant_id, slug)`), so a
     * foreign clinic's category cannot be rendered inside this one's page.
     */
    caller.product.list({ tenantSlug, categorySlug }),
  ]);

  if (!category) notFound();

  return (
    <div className="px-6 md:px-10 mx-auto max-w-[1400px] py-10 md:py-14 flex-1">
      <header className="mb-8">
        <h1 className="text-[28px] md:text-[36px] font-medium tracking-[-0.03em] text-foreground">
          {category.name}
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {result.total} {result.total === 1 ? "product" : "products"} from{" "}
          {tenant.name}
        </p>
      </header>

      {/*
        A real category with zero products gets a different message from an
        empty filter result. "No products in Heart Health yet" tells the
        visitor the clinic is still setting up, which is a completely
        different signal from "nothing matched your search".
      */}
      <ProductGrid
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        products={result.items}
        emptyMessage={`No products in ${category.name} yet.`}
      />
    </div>
  );
}