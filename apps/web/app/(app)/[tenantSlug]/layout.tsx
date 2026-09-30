import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TRPCError } from "@trpc/server";

import { api } from "@/server/caller";
import { AnnouncementBar, StoreFooter, StoreHeader } from "@/components/storefront/blocks/chrome";
import type {
  CategoryView,
  StorefrontConfigView,
  TenantBranding,
  TenantRole,
  TenantView,
} from "@/lib/storefront-types";

/**
 * THE TENANT RESOLUTION POINT.
 *
 * Every page under `/{tenantSlug}/**` — storefront, shop, product, category,
 * and admin — renders inside this layout. That is deliberate: the tenant is
 * resolved here, once per navigation, and every child reads it from context
 * instead of re-querying.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE MOCKS ARE GONE. All three data sources below are real tRPC calls now:
 *
 *     caller.tenant.getBySlug(...)   → tenant + storefront config
 *     caller.category.list(...)      → the category nav
 *     caller.tenant.meRole(...)      → the visitor's role in this clinic
 *
 * `meRole` exists precisely because this layout needs the caller's OWN role,
 * not the "admin owns everything" mock. See the procedure for why it is a
 * public, session-tolerant read.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── Why a layout, and not each page ─────────────────────────────────────
 * `generateMetadata` and the layout body both need the tenant, and so does
 * the header. Resolving per page would mean three lookups per navigation
 * instead of one, and would drift the moment one page forgot. The layout is
 * the natural seam: it is the highest point that still wraps every child.
 *
 * ── Server Components throughout ────────────────────────────────────────
 * No "use client" in this subtree except two leaves that genuinely need
 * browser state (`MobileNav` and the shop filters). That is what keeps the
 * storefront's JavaScript payload near zero, which matters when the visitor
 * is on a phone on a slow connection.
 */

type LayoutProps = {
  children: React.ReactNode;
  /** Next 16: dynamic route params arrive as a Promise and must be awaited. */
  params: Promise<{ tenantSlug: string }>;
};

type TenantData = {
  /**
   * Typed against the real router now, so no `NonNullable<>` wrapper is
   * needed: `tenant.getBySlug` returns `TenantView`, never null — resolution
   * failure is a THROW, not a null, and the translation of that throw into a
   * 404 happens in `getTenantData` below.
   */
  tenant: TenantView;
  categories: CategoryView[];
  /**
   * NULLABLE ON PURPOSE. `FEATURES.md` §2 gives consumers no account, so most
   * visitors to this layout are anonymous and there is no role for them. The
   * storefront must render regardless — the Admin link is simply absent.
   *
   * The ADMIN layout is where a null role becomes a redirect, and it does
   * that check itself. This layout must never deny a visitor a public page,
   * or a missing session would take the whole storefront down with it.
   */
  role: TenantRole | null;
  config: StorefrontConfigView;
};

/**
 * The fallback used when a tenant exists but has no storefront row.
 *
 * In production this is unreachable: `storefronts.config` is NOT NULL and
 * signup inserts the row inside the same transaction as the tenant. It exists
 * because a config-less storefront should degrade to *something* rather than
 * crash the whole subtree. The values are visibly generic, so a half-built
 * tenant is obvious in a demo instead of silently rendering blank sections.
 */
const FALLBACK_CONFIG: StorefrontConfigView = {
  hero: {
    headline: "Storefront not configured yet",
    subheadline:
      "This clinic exists but has not finished setting up its storefront.",
    ctaLabel: "Browse products",
    ctaHref: "/shop",
  },
  theme: {
    primaryColor: "#64748B",
    fontFamily: "sans",
    showTrustBadges: false,
  },
  announcement: null,
  showCategories: false,
};

async function getTenantData(tenantSlug: string): Promise<TenantData> {
  /**
   * In-process tRPC, not HTTP. That matters for error handling: the caller
   * THROWS a `TRPCError` that never crosses a network boundary, so there is
   * no router in between to turn `NOT_FOUND` into a 404.
   */
  try {
    const caller = await api();
    const [tenant, categories, role] = await Promise.all([
      caller.tenant.getBySlug({ tenantSlug }),
      caller.category.list({ tenantSlug }),
      caller.tenant.meRole({ tenantSlug }),
    ]);

    return {
      tenant,
      categories,
      role,
      config: tenant.config ?? FALLBACK_CONFIG,
    };
  } catch (error) {
    /**
     * `notFound()` renders the nearest `not-found.tsx` and sets HTTP 404.
     *
     * Translating "no such tenant" into a 404 HERE rather than in every page
     * is what makes `/{typo}` a clean 404 instead of a 500. Without it the
     * error would escape to the error boundary and the visitor would get a
     * stack-trace page.
     *
     * The `instanceof` check is the distinction the mock layer used to draw
     * for you: a NOT_FOUND from tenant resolution means "no such clinic" and
     * becomes a 404; anything else — a database outage, say — must be
     * re-thrown. Swallowing every error into a 404 would tell a user "this
     * clinic does not exist" when the truth is "our database is down", and
     * would hide a real outage from monitoring.
     *
     * All three calls above share `resolveTenant`, so they throw NOT_FOUND in
     * lockstep for an unknown slug; catching it once covers all three.
     */
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  const { tenant, config } = await getTenantData(tenantSlug);

  return {
    title: `${tenant.name} — healthStation`,
    description: config.hero.subheadline,
    /**
     * Per-tenant Open Graph images would need a dynamic route handler to
     * render them. Out of scope for the demo; noted in ROADMAP §7 so it is a
     * decision rather than an oversight.
     */
  };
}

export default async function TenantLayout({ children, params }: LayoutProps) {
  const { tenantSlug } = await params;
  const { tenant, categories, role, config } = await getTenantData(tenantSlug);

  /**
   * THE THEME, AS ONE CSS VARIABLE.
   *
   * The owner's `primaryColor` is applied here, on a wrapper, as a single
   * custom property. Better than threading a `color` prop through every
   * component, for three reasons:
   *
   * 1. SCOPE. Setting `--tenant-primary` on this element means it — and
   *    everything inside — resolves to the clinic's color, while the landing
   *    page above is untouched. A global `:root` write would leak Cairo's red
   *    onto every other clinic on a client-side navigation, because `:root`
   *    outlives the navigation.
   * 2. NO RE-RENDER. Changing the color is a one-attribute change on a single
   *    server-rendered element. The children do not re-render, do not
   *    re-fetch, and their props did not change.
   * 3. ONE PLACE TO VALIDATE. See below.
   *
   * ── Why the inline hex is safe ──────────────────────────────────────
   * An owner-controlled string in a `style` attribute is normally an XSS
   * vector: `red; } body { display: none }` is a valid `text` field to a
   * form and a broken stylesheet to a browser. It is safe HERE only because
   * the storefront router's Zod schema constrains `primaryColor` to
   * `/^#[0-9a-fA-F]{6}$/`. That validation is the security control — do not
   * relax the schema without moving this validation somewhere else first.
   */
  const primaryColor = config.theme.primaryColor;

  const branding: TenantBranding = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
  };

  return (
    <div
      style={{ "--tenant-primary": primaryColor } as React.CSSProperties}
      className="min-h-screen flex flex-col"
    >
      <AnnouncementBar text={config.announcement} primaryColor={primaryColor} />
      <StoreHeader tenant={branding} categories={categories} role={role} />

      {/*
        `flex-1` pushes the footer to the bottom of the viewport on a short
        page. Without it, a category with two products leaves a footer
        stranded mid-screen and a large white gap beneath it.
      */}
      <div className="flex-1 flex flex-col">{children}</div>

      <StoreFooter tenant={branding} />
    </div>
  );
}
