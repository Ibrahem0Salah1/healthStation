import { ProductForm } from "@/components/admin/product-form";
import { api } from "@/server/caller";

/**
 * `/admin/products/new`
 *
 * A thin route that gathers data and hands it to the shared form. Nothing
 * more. The form itself lives in `components/admin/product-form.tsx` so that
 * the "new" and "edit" screens cannot drift apart — the most common way a
 * duplicate form in an admin diverges is that someone fixes a validation hint
 * in one copy and forgets the other.
 *
 * No `notFound()` guard: the admin layout has already proven the tenant exists
 * and the caller is a member, so `tenant.getBySlug` cannot miss. A guarded
 * null here would be unreachable code that invites a reviewer to think there
 * is a real "tenant missing" path on this page.
 */
export default async function NewProductPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const caller = await api();
  const categories = await caller.category.listForAdmin({ tenantSlug });

  return <ProductForm tenantSlug={tenantSlug} categories={categories} />;
}