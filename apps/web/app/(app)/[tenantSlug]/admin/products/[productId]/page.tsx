import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";
import { api } from "@/server/caller";

/**
 * `/admin/products/[productId]` — the edit screen.
 *
 * ── WHY THE ROUTE KEY IS `productId` AND NOT `productSlug` ──────────────
 * The id is stable and unique. A slug is neither: an owner can change a
 * product's slug, which would break every saved edit URL pointing at the old
 * one. Internal links that identify a resource should use the immutable
 * identifier; slugs are for humans, and belong in the PUBLIC path.
 *
 * The public product page uses the slug (`/product/[productSlug]`) and the
 * admin page uses the id (`/products/[productId]`). That asymmetry is
 * deliberate and is worth being able to justify.
 *
 * ── 404, NOT AN EMPTY FORM ─────────────────────────────────────────────
 * `getForAdmin` returns null for a miss (rather than throwing — see the
 * procedure), and the null becomes `notFound()`. A bad id means the resource
 * is gone, and rendering an empty form would save an empty product over
 * nothing — turning a broken link into data corruption.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; productId: string }>;
}) {
  const { tenantSlug, productId } = await params;

  const caller = await api();
  const [product, categories] = await Promise.all([
    caller.product.getForAdmin({ tenantSlug, productId }),
    caller.category.listForAdmin({ tenantSlug }),
  ]);

  if (!product) notFound();

  /*
   * `categoryId` is lifted out of the nested `category` object.
   *
   * The list gives us the joined category so the TABLE can show its name.
   * The form needs the id to preselect the option. Re-deriving the id by
   * looking the category up again would be a second query to get a value we
   * already had, so it is carried through here at the route boundary.
   */
  const categoryId =
    categories.find((c) => c.id === product.category?.id)?.id ?? null;

  return (
    <ProductForm
      tenantSlug={tenantSlug}
      categories={categories}
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        summary: product.summary,
        description: product.description,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
        categoryId,
        isActive: product.isActive,
        details: product.details,
      }}
    />
  );
}