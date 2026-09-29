import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";

import { ProductCard } from "@/components/storefront/product-card";
import type { ProductCardView, TenantBranding } from "@/lib/storefront-types";

/**
 * The featured-products band.
 *
 * Responsive by grid, not by breakpoint variants:
 * `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` is what makes a product grid
 * usable on a phone. A two-column grid at 375px gives each card ~150px,
 * which cannot hold a product name on two lines. One column below `sm` is the
 * only correct answer.
 *
 * `section` + `aria-labelledby` rather than a bare `div`: this is a labelled
 * region, and a screen reader user navigating by region should be able to
 * jump to "Featured products" the same way a sighted user reads the heading.
 */
export function FeaturedProducts({
  tenant,
  products,
  title = "Featured treatments",
}: {
  tenant: TenantBranding;
  products: ProductCardView[];
  title?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="px-6 md:px-10 mx-auto max-w-[1400px] py-14 md:py-20">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h2
            id="featured-heading"
            className="text-[24px] md:text-[30px] font-medium tracking-[-0.025em] text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Reviewed by our clinical team before listing.
          </p>
        </div>

        <Link
          href={`/${tenant.slug}/shop`}
          className="hidden sm:inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <ProductGrid products={products} tenant={tenant} />
    </section>
  );
}

/**
 * The grid, shared between the home page and the shop.
 *
 * `items-stretch` (the default) plus `h-full` on the card is what makes cards
 * in a row equal height. Without `h-full` the card hugs its content, so a
 * product with a two-line name sits shorter than its neighbours and the
 * price row does not line up across the row. This is the single most common
 * visual bug in a product grid.
 */
export function ProductGrid({
  tenant,
  products,
  emptyMessage = "No products here yet.",
}: {
  tenant: TenantBranding;
  products: ProductCardView[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return <EmptyGrid message={emptyMessage} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} tenantSlug={tenant.slug} />
      ))}
    </div>
  );
}

function EmptyGrid({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
      <Package className="w-9 h-9 text-muted-foreground/40" />
      <p className="text-[14px] text-muted-foreground">{message}</p>
    </div>
  );
}
