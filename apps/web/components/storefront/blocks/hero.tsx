import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import type { StorefrontConfigView, TenantBranding } from "@/lib/storefront-types";

/**
 * The storefront hero.
 *
 * 100% tenant copy, zero hardcoded text. Every string on this screen comes
 * from `config.hero`, which the owner edits in `/{slug}/admin/storefront`. That
 * is the whole point of the JSONB config: two clinics running identical code
 * and looking like two different businesses.
 *
 * PURE SERVER COMPONENT. No "use client", no `motion`. The landing page uses
 * `motion/react` because it is a marketing page where entrance animation is
 * the product. A storefront visitor has arrived from a search result or a
 * referral — they want the product, not a reveal. Animating would cost
 * hydration and delay first paint for a stranger.
 *
 * The `ctaHref` value is owner-controlled, so it is validated to a relative
 * path in the router's Zod schema. Do not relax that — see the note on the
 * tenant layout's `primaryColor` for the same class of issue.
 */
export function StoreHero({
  tenant,
  config,
}: {
  tenant: TenantBranding;
  config: StorefrontConfigView;
}) {
  const { hero } = config;

  return (
    <section
      className="relative overflow-hidden border-b border-border/60"
      style={{
        background:
          "radial-gradient(60% 90% at 12% 0%, color-mix(in oklch, var(--tenant-primary) 9%, transparent) 0%, transparent 62%)",
      }}
    >
      <div className="px-6 md:px-10 mx-auto max-w-[1400px] py-16 md:py-24">
        <div className="max-w-[760px]">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium border"
            style={{
              backgroundColor: "color-mix(in oklch, var(--tenant-primary) 8%, white)",
              borderColor: "color-mix(in oklch, var(--tenant-primary) 18%, transparent)",
              color: "var(--tenant-primary)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {tenant.name}
          </span>

          <h1 className="mt-6 text-[34px] md:text-[52px] font-medium leading-[1.08] tracking-[-0.035em] text-foreground text-balance">
            {hero.headline}
          </h1>

          <p className="mt-5 text-[15px] md:text-[17px] leading-[1.65] text-muted-foreground max-w-[600px] text-pretty">
            {hero.subheadline}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {/*
              `ctaHref` is a relative path like "/shop" — NOT absolute. The
              owner cannot link to another tenant, an external site, or a
              javascript: URL, because the router's Zod schema rejects
              anything that is not a leading-slash path. The leading slash is
              therefore load-bearing: it anchors the link inside this tenant's
              subtree.
            */}
            <Link
              href={`/${tenant.slug}${hero.ctaHref}`}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:gap-3 hover:opacity-90"
              style={{ backgroundColor: "var(--tenant-primary)" }}
            >
              {hero.ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href={`/${tenant.slug}/shop`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-[14px] font-medium text-foreground shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-muted transition-colors"
            >
              View all products
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
