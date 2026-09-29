import Link from "next/link";
import { BadgeCheck, Stethoscope, Truck } from "lucide-react";

import type { StorefrontConfigView } from "@/lib/storefront-types";

/**
 * Trust badges.
 *
 * GATED ON `config.theme.showTrustBadges`. A clinic that has not earned these
 * claims should not display them, and that decision is the owner's, made in
 * the admin editor — no deploy, no code change. This is the config-driven
 * behaviour `FEATURES.md` §4 asks for, in its smallest possible form.
 *
 * Rendered from the DB, not from a shared constant, because the *copy* is
 * the claim. A platform that prints "Licensed Specialists" on a clinic's
 * behalf is making a statement about a business it knows nothing about.
 */
const BADGES = [
  {
    icon: Stethoscope,
    title: "Clinician reviewed",
    body: "Every product is reviewed by our clinical team before it is listed.",
  },
  {
    icon: Truck,
    title: "Discreet delivery",
    body: "Plain packaging. No medical details on the outside of the box.",
  },
  {
    icon: BadgeCheck,
    title: "Verified supply",
    body: "Third-party tested for heavy metals and product integrity.",
  },
] as const;

export function TrustBadges({ config }: { config: StorefrontConfigView }) {
  if (!config.theme.showTrustBadges) return null;

  return (
    <section className="border-y border-border/60 bg-muted/20">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px] py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {BADGES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3.5">
              <span
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor:
                    "color-mix(in oklch, var(--tenant-primary) 10%, white)",
                  color: "var(--tenant-primary)",
                }}
              >
                <Icon className="w-5 h-5" />
              </span>

              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The closing call to action.
 *
 * A storefront that ends on a product grid leaves the visitor with nothing to
 * do. This is the second conversion point and it repeats the hero's action,
 * which is deliberate: a visitor who scrolled past the hero without clicking
 * was not ready then, and may be now.
 */
export function StoreCta({
  tenant,
  config,
}: {
  tenant: { name: string; slug: string };
  config: StorefrontConfigView;
}) {
  return (
    <section
      className="mx-6 md:mx-10 mb-14 md:mb-20 rounded-2xl border border-border/60 overflow-hidden"
      style={{
        background:
          "radial-gradient(70% 120% at 50% 0%, color-mix(in oklch, var(--tenant-primary) 8%, white) 0%, white 70%)",
      }}
    >
      <div className="px-8 md:px-16 py-14 md:py-20 text-center">
        <h2 className="mx-auto max-w-[560px] text-[24px] md:text-[32px] font-medium leading-[1.2] tracking-[-0.03em] text-foreground text-balance">
          {config.hero.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-[1.6] text-muted-foreground text-pretty">
          {config.hero.subheadline}
        </p>

        <Link
          href={`/${tenant.slug}${config.hero.ctaHref}`}
          className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:gap-3"
          style={{ backgroundColor: "var(--tenant-primary)" }}
        >
          {config.hero.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
