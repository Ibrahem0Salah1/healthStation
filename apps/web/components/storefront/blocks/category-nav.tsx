import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";

import type { CategoryView, TenantBranding } from "@/lib/storefront-types";

/**
 * The category nav strip.
 *
 * Renders NOTHING when there are no categories. Not an empty section, not a
 * heading with nothing under it — genuinely zero output. A clinic that has
 * not created a category yet gets a storefront with no dead nav, which is a
 * small discipline that separates a template from a product.
 *
 * The count is server-computed per category. Note that this is ONE value per
 * category, delivered with the category, rather than the component counting
 * products itself. If each card counted its own products you would have an
 * N+1: one query for the categories and one per card on top.
 *
 * Horizontally scrollable on mobile via `overflow-x-auto` + `snap-x` rather
 * than a wrapping flex or a hamburger. Nine categories is a realistic ceiling
 * for a clinic catalog, and a wrapping row reflows unpredictably at awkward
 * widths. A scroll strip keeps the row a fixed height at every viewport.
 */
export function CategoryNav({
  tenant,
  categories,
}: {
  tenant: TenantBranding;
  categories: CategoryView[];
}) {
  if (categories.length === 0) return null;

  return (
    <section className="border-b border-border/60 bg-muted/30">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px] py-8">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold tracking-wider uppercase text-muted-foreground">
            Shop by category
          </h2>
        </div>

        <nav
          className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory
                     [-ms-overflow-style:none] [scrollbar-width:none]
                     [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${tenant.slug}/category/${category.slug}`}
              className="group shrink-0 snap-start inline-flex items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-2.5
                         hover:border-foreground/20 hover:shadow-sm transition-all"
            >
              <span className="text-[14px] font-medium text-foreground group-hover:text-muted-foreground transition-colors">
                {category.name}
              </span>

              {typeof category.productCount === "number" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {category.productCount}
                </span>
              ) : null}

              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
