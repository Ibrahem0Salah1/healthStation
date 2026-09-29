import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";

import { formatPrice } from "@/lib/money";

/**
 * A product card.
 *
 * Deliberately a Server Component with no "use client". A shop grid of 12
 * products would otherwise ship 12 client components' worth of hydration
 * overhead for a component that displays data and nothing more.
 *
 * The trade: no click-to-add-to-cart, no wishlist, no quick view. `FEATURES.md`
 * puts cart and checkout out of scope, so there is genuinely no interaction
 * to hydrate. When a cart arrives this becomes a client component — and that
 * is a fine, cheap change, because the data it needs is already typed here.
 */
export function ProductCard({
  product,
  tenantSlug,
}: {
  product: {
    name: string;
    slug: string;
    summary: string;
    priceCents: number;
    currency: string;
    imageUrl: string | null;
  };
  tenantSlug: string;
}) {
  return (
    <Link
      href={`/${tenantSlug}/product/${product.slug}`}
      className="group flex flex-col rounded-2xl border border-border/60 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-foreground/20 transition-all"
    >
      <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          /*
            `next/image` would optimize, but the images here are four local
            SVGs from `public/products/`. Next's image optimizer does not
            rasterize SVG, so it would add a request hop and gain nothing.
            When real photo uploads arrive this becomes `next/image` with
            `width`/`height` — the swap is one element.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain p-8 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Package className="w-10 h-10 text-muted-foreground/40" />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2">
          {product.name}
        </h3>

        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
          {product.summary}
        </p>

        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
          <span className="text-[16px] font-semibold text-foreground">
            {formatPrice(product.priceCents, product.currency)}
          </span>

          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            View
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
