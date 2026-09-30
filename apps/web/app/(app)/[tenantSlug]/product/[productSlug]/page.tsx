import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TRPCError } from "@trpc/server";
import { ArrowLeft, Package, ShieldCheck } from "lucide-react";

import { ProductGrid } from "@/components/storefront/blocks/featured-products";
import { formatPrice } from "@/lib/money";
import { api } from "@/server/caller";
import type { ProductCardView, ProductView, TenantView } from "@/lib/storefront-types";


type PageProps = {
  params: Promise<{ tenantSlug: string; productSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug, productSlug } = await params;

  try {
    const caller = await api();
    const { product } = await caller.product.detail({ tenantSlug, productSlug });
    return {
      title: `${product.name} — ${product.slug}`,
      description: product.summary,
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { tenantSlug, productSlug } = await params;

  let tenant: TenantView;
  let product: ProductView;
  let siblings: ProductCardView[];

  try {
    const caller = await api();
    const [resolvedTenant, detail] = await Promise.all([
      caller.tenant.getBySlug({ tenantSlug }),
      caller.product.detail({ tenantSlug, productSlug }),
    ]);
    tenant = resolvedTenant;
    product = detail.product;
    siblings = detail.related;
  } catch (error) {
    /*
     * `product.detail` throws NOT_FOUND for a missing OR inactive slug. The
     * tenant NOT_FOUND case is already handled by the layout; this catch
     * exists for the product NOT_FOUND, and should not swallow a database
     * outage as a 404.
     */
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  if (!tenant) notFound();

  const base = `/${tenant.slug}`;

  return (
    <div className="flex-1">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px] py-8 md:py-12">
        <Link
          href={`${base}/shop`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to shop
        </Link>

        <div className="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <div className="aspect-square rounded-2xl border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain p-10"
              />
            ) : (
              <Package className="w-14 h-14 text-muted-foreground/30" />
            )}
          </div>

          <div className="flex flex-col">
            {product.category ? (
              <Link
                href={`${base}/category/${product.category.slug}`}
                className="self-start rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {product.category.name}
              </Link>
            ) : null}

            <h1 className="mt-4 text-[28px] md:text-[36px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground text-balance">
              {product.name}
            </h1>

            <p className="mt-4 text-[17px] font-semibold text-foreground">
              {formatPrice(product.priceCents, product.currency)}
            </p>

            <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground text-pretty">
              {product.summary}
            </p>

            {/*
              A disabled button rather than a "Buy" button.

              `FEATURES.md` §2 puts cart and checkout out of scope, and a
              storefront that shows a working-looking buy button with no cart
              behind it is worse than one that says so.
            */}
            <button
              type="button"
              disabled
              title="Cart and checkout are out of scope for this build"
              className="mt-8 w-full sm:w-auto rounded-full px-8 py-3.5 text-[15px] font-semibold
                         text-white shadow-sm cursor-not-allowed opacity-60"
              style={{ backgroundColor: "var(--tenant-primary)" }}
            >
              Add to cart
            </button>
            <p className="mt-2.5 text-[12px] text-muted-foreground">
              Online ordering is not enabled for this clinic. Contact them to
              arrange a purchase.
            </p>

            <ProductFacts product={product} />
          </div>
        </div>

        <section className="mt-16 md:mt-24 max-w-[720px]">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
            About this product
          </h2>
          <p className="mt-4 text-[15px] leading-[1.75] text-muted-foreground whitespace-pre-line text-pretty">
            {product.description}
          </p>
        </section>
      </div>

      {siblings.length > 0 ? (
        <section className="px-6 md:px-10 mx-auto max-w-[1400px] pb-16 md:pb-24">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground mb-6">
            More in {product.category?.name ?? "this clinic"}
          </h2>
          <ProductGrid
            tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
            products={siblings}
          />
        </section>
      ) : null}
    </div>
  );
}

/**
 * The specification table.
 *
 * `ProductDetails` is a FIXED platform shape (`FEATURES.md` §5.2), not
 * something each clinic defines: a supplement with no pack size is not
 * sellable, so the fields are not optional.
 *
 * `activeIngredients` is rendered as a list only when non-empty — a product
 * with no actives (a monitor, say) should not show an empty section header.
 */
function ProductFacts({ product }: { product: ProductView }) {
  const { details } = product;

  const rows: { label: string; value: string }[] = [
    { label: "Pack size", value: details.packSize },
    {
      label: "Type",
      value: details.generic ? "Generic" : "Brand name",
    },
    {
      label: "Prescription",
      value: details.requiresPrescription ? "Required" : "Not required",
    },
  ];

  return (
    <dl className="mt-10 pt-8 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[12px] font-semibold tracking-wider uppercase text-muted-foreground">
            {row.label}
          </dt>
          <dd className="mt-1.5 text-[15px] text-foreground">{row.value}</dd>
        </div>
      ))}

      {details.activeIngredients.length > 0 ? (
        <div className="sm:col-span-2">
          <dt className="text-[12px] font-semibold tracking-wider uppercase text-muted-foreground">
            Active ingredients
          </dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {details.activeIngredients.map((ingredient) => (
              <span
                key={ingredient}
                className="rounded-full border border-border bg-white px-3 py-1 text-[13px] text-foreground"
              >
                {ingredient}
              </span>
            ))}
          </dd>
        </div>
      ) : null}

      {details.requiresPrescription ? (
        <div className="sm:col-span-2 flex items-start gap-2.5 rounded-xl bg-muted/60 p-4">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            A valid prescription from a licensed clinician is required. Upload
            it during your telehealth consultation.
          </p>
        </div>
      ) : null}
    </dl>
  );
}