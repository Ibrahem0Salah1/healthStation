import Link from "next/link";
import { AlertTriangle, FolderTree, Package, Palette, Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shell";
import { formatPrice } from "@/lib/money";
import { api } from "@/server/caller";

/**
 * THE ADMIN DASHBOARD.
 *
 * Counts only. No charts, no activity feed, no revenue — because none of
 * those have a data source in `FEATURES.md`. A dashboard that displays
 * invented metrics is worse than one that displays four real numbers, and
 * the four below are all things an owner genuinely needs on opening the page:
 * what do I have, is it visible, and how do I add more.
 *
 * All four queries in one `Promise.all`. They are independent, and the
 * slowest one is the product list — serialising four round trips to render
 * four numbers would be the most obvious performance mistake on the site.
 */
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const caller = await api();
  const [tenant, products, categories] = await Promise.all([
    caller.tenant.getBySlug({ tenantSlug }),
    caller.product.listForAdmin({ tenantSlug }),
    caller.category.listForAdmin({ tenantSlug }),
  ]);

  if (!tenant) return null;

  /*
   * `config` arrives nested inside `tenant.getBySlug` — it is part of the
   * tenant row, not a separate table. There is no extra round trip.
   */
  const config = tenant.config;

  const base = `/${tenant.slug}/admin`;

  const active = products.filter((product) => product.isActive);
  const hidden = products.length - active.length;
  const uncategorised = products.filter((product) => !product.category).length;

  const stats = [
    {
      label: "Active products",
      value: active.length,
      icon: Package,
      href: `${base}/products`,
      detail: hidden > 0 ? `${hidden} hidden` : "All visible",
    },
    {
      label: "Categories",
      value: categories.length,
      icon: FolderTree,
      href: `${base}/categories`,
      detail: `${uncategorised} uncategorised`,
    },
    {
      label: "Catalogue value",
      value: formatPrice(
        active.reduce((total, product) => total + product.priceCents, 0),
        active[0]?.currency ?? "USD",
      ),
      icon: Package,
      href: `${base}/products`,
      detail: "Sum of active products",
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`Manage the ${tenant.name} storefront and catalogue.`}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-border/60 bg-white p-5
                       hover:border-foreground/20 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--tenant-primary) 10%, white)",
                  color: "var(--tenant-primary)",
                }}
              >
                <stat.icon className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium text-muted-foreground">
                {stat.label}
              </span>
            </div>

            <p className="mt-4 text-[26px] font-medium tracking-[-0.02em] text-foreground tabular-nums">
              {stat.value}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">{stat.detail}</p>
          </Link>
        ))}
      </div>

      {/*
        A real warning rather than a silent state. Hidden products are a
        deliberate feature (soft delete), so an owner who cannot see how many
        they have hidden will eventually be confused by a storefront that
        looks emptier than the admin suggests. The inverse is worse: seeing
        them listed as active when they are not.
      */}
      {hidden > 0 ? (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-medium text-foreground">
              {hidden} {hidden === 1 ? "product is" : "products are"} hidden
            </p>
            <p className="mt-1 text-muted-foreground">
              Hidden products stay in the database but do not appear on your
              storefront. They are preserved so any future order history keeps
              its references.
            </p>
          </div>
        </div>
      ) : null}

      {uncategorised > 0 ? (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-4">
          <FolderTree className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-medium text-foreground">
              {uncategorised} {uncategorised === 1 ? "product has" : "products have"} no
              category
            </p>
            <p className="mt-1 text-muted-foreground">
              Uncategorised products still appear in your shop, but not under
              any category.{" "}
              <Link href={`${base}/categories`} className="underline underline-offset-2">
                Create categories
              </Link>{" "}
              to organise them.
            </p>
          </div>
        </div>
      ) : null}

      {/*
        The two setup tasks that decide whether the storefront looks finished.
        A clinic that signed up has a tenant, a membership and a storefront
        row with generated placeholder copy — but no products and default
        branding. This is the screen that tells them so.
      */}
      <div className="rounded-2xl border border-border/60 bg-white p-6">
        <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-foreground">
          Storefront setup
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <SetupRow
            done={products.length > 0}
            title="Add your first product"
            description="Your storefront is empty until it has at least one active product."
            href={`${base}/products/new`}
            cta="Add product"
          />

          <SetupRow
            done={!config?.theme.primaryColor.startsWith("#64748B")}
            title="Set your brand colour"
            description="Currently using the default grey placeholder from signup."
            href={`${base}/edit-storefront`}
            cta="Edit storefront"
          />
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border/60 p-4">
        <Palette className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Every change you make here appears on{" "}
          <Link href={`/${tenant.slug}`} className="underline underline-offset-2">
            {tenant.name}&apos;s storefront
          </Link>{" "}
          immediately. There is no publish step — which means there is also no
          draft state to recover to.
        </p>
      </div>
    </>
  );
}

function SetupRow({
  done,
  title,
  description,
  href,
  cta,
}: {
  done: boolean;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold ${
          done ? "bg-green-500/15 text-green-700" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : ""}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-foreground">
          {title}
          {/*
            The status word is text, not just a colour. A green tick is
            invisible to a screen reader, so the accessible name has to carry
            the state too.
          */}
          <span className="sr-only">{done ? " — complete" : " — not done yet"}</span>
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>

      {!done ? (
        <Link
          href={href}
          className="shrink-0 rounded-full border border-border bg-white px-3.5 py-1.5
                     text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
        >
          {cta}
        </Link>
      ) : null}
    </div>
  );
}
