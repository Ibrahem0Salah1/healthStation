import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shell";
import { ProductVisibilityToggle } from "@/components/admin/product-visibility-toggle";
import { formatPrice } from "@/lib/money";
import { api } from "@/server/caller";
import type { ProductAdminView } from "@/lib/storefront-types";

/**
 * THE PRODUCT TABLE.
 *
 * ── WHY A TABLE AND NOT A GRID OF CARDS ─────────────────────────────────
 * An admin list is a comparison surface, not a browsing surface. An owner
 * needs to scan a column of prices and find the one that is wrong, and a
 * table does that in a way cards cannot. Cards would be the right choice on
 * the public storefront and the wrong one here.
 *
 * ── RESPONSIVE, WITHOUT DUPLICATING THE TABLE ──────────────────────────
 * A real `<table>` cannot reflow to a phone. Two options:
 *
 *   A) Horizontal scroll — a wrapper with `overflow-x-auto`. Preserves the
 *      table semantics exactly, costs a scroll on mobile.
 *   B) `display: block` overrides that turn each row into a card — destroys
 *      the table semantics, and a screen reader navigating by cell now reads
 *      a flat mess.
 *
 * (A) is chosen deliberately. Table semantics are worth more than a
 * phone-optimised layout for data this dense, and a horizontally scrollable
 * table is a well-understood pattern.
 *
 * ── `<caption className="sr-only">` ────────────────────────────────────
 * A caption is how a table introduces itself to a screen reader user
 * navigating by table. Visible captions are a dated pattern, but removing
 * the element entirely loses that affordance — so it is kept and hidden.
 *
 * ── REAL DATA NOW ──────────────────────────────────────────────────────
 * Both calls go through the in-process tRPC caller. `listForAdmin` is an
 * `adminProcedure` — the layout has already proven membership, and this
 * resolver re-proves it with the same session before a single row is read.
 */
export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const caller = await api();
  const [tenant, products] = await Promise.all([
    caller.tenant.getBySlug({ tenantSlug }),
    caller.product.listForAdmin({ tenantSlug }),
  ]);

  if (!tenant) notFound();

  const base = `/${tenant.slug}/admin`;

  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${products.length} ${products.length === 1 ? "product" : "products"} in ${tenant.name}.`}
        action={
          <Link
            href={`${base}/products/new`}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--tenant-primary)" }}
          >
            <Plus className="w-4 h-4" />
            New product
          </Link>
        }
      />

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="text-[15px] text-foreground font-medium">No products yet</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Your storefront is empty. Add your first product to get started.
          </p>
          <Link
            href={`${base}/products/new`}
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--tenant-primary)" }}
          >
            <Plus className="w-4 h-4" />
            New product
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <caption className="sr-only">
                All products in {tenant.name}, with price, category and visibility.
              </caption>

              <thead>
                <tr className="border-b border-border/60">
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th align="right">Price</Th>
                  <Th>Visible</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    tenantSlug={tenantSlug}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3.5 text-[12px] font-semibold tracking-wider uppercase text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function ProductRow({
  product,
  tenantSlug,
}: {
  product: ProductAdminView;
  tenantSlug: string;
}) {
  const base = `/${tenantSlug}/admin`;

  return (
    <tr className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-5 py-4">
        <Link href={`${base}/products/${product.id}`} className="group block min-w-0">
          <span className="text-[14px] font-medium text-foreground group-hover:underline underline-offset-2">
            {product.name}
          </span>
          <span className="mt-0.5 block text-[12px] text-muted-foreground font-mono">
            /{product.slug}
          </span>
        </Link>
      </td>

      <td className="px-5 py-4 text-[13px] text-muted-foreground">
        {product.category ? (
          product.category.name
        ) : (
          <span className="text-muted-foreground/60">Uncategorised</span>
        )}
      </td>

      <td className="px-5 py-4 text-[14px] text-foreground tabular-nums text-right whitespace-nowrap">
        {formatPrice(product.priceCents, product.currency)}
      </td>

      {/*
        The visibility column is a client island now: it posts `product.setActive`
        and `router.refresh()` re-renders this server-rendered table. The three
        invalidations live inside the island, not here.
      */}
      <td className="px-5 py-4">
        <ProductVisibilityToggle
          tenantSlug={tenantSlug}
          productId={product.id}
          isActive={product.isActive}
        />
      </td>

      <td className="px-5 py-4 text-right whitespace-nowrap">
        <Link
          href={`${base}/products/${product.id}`}
          className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}