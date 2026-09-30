import Link from "next/link";
import { Package } from "lucide-react";

import { CategoryAdminForm } from "@/components/admin/categoryAdminForm";
import { AdminPageHeader } from "@/components/admin/shell";
import { api } from "@/server/caller";

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const caller = await api();
  const categories = await caller.category.listForAdmin({ tenantSlug });

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="Categories organise your shop and drive the category navigation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="rounded-2xl border border-border/60 bg-white overflow-hidden">
          {categories.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-[14px] font-medium text-foreground">
                No categories yet
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Create one using the form, and it appears in your shop
                navigation immediately.
              </p>
            </div>
          ) : (
            <ul>
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center gap-4 px-5 py-4 border-b border-border/40 last:border-b-0"
                >
                  {/*
                    `tabular-nums` so reordering a list does not make the
                    numbers jitter as the digit count changes. Small detail,
                    visible the moment you drag anything.
                  */}
                  <span className="w-6 text-[12px] font-medium text-muted-foreground tabular-nums">
                    {category.sortOrder}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-foreground">
                      {category.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground font-mono truncate">
                      /{category.slug}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      (category.productCount ?? 0) > 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-500/10 text-amber-700"
                    }`}
                  >
                    {category.productCount ?? 0}{" "}
                    {category.productCount === 1 ? "product" : "products"}
                  </span>

                  <Link
                    href={`/${tenantSlug}/category/${category.slug}`}
                    className="shrink-0 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CategoryAdminForm tenantSlug={tenantSlug} />
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border/60 p-4">
        <Package className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Category names do not have to be unique across clinics. Two clinics
          can both have &quot;Pain Relief&quot; — they are different tenants
          sharing a slug space, which is why the uniqueness constraint is
          scoped to{" "}
          <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
            (tenant_id, slug)
          </code>
          .
        </p>
      </div>
    </>
  );
}
