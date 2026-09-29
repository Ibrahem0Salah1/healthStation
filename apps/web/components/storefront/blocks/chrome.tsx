import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { MobileNav } from "@/components/storefront/mobile-nav";
import type { CategoryView, TenantBranding, TenantRole } from "@/lib/storefront-types";

/**
 * Storefront chrome — header, announcement bar, footer.
 *
 * SERVER COMPONENTS, with one client leaf (`MobileNav`) for the disclosure.
 *
 * ── The role prop, and the thing it is not ──────────────────────────────
 * `role` is computed on the server and passed DOWN. The browser is never
 * asked "is this visitor an owner?" — it is told.
 *
 * That is the right way round, and the reason matters for the interview:
 * rendering the Admin link and hiding it with CSS, or fetching "am I an
 * admin?" in the browser, both leak the existence of an admin surface to
 * every visitor AND cost a round trip. Neither is a security control — the
 * real one is `hasRole` in the tRPC middleware plus `requireRole()` in the
 * admin layout. This link is a convenience, so it can be as casual as it
 * likes: delete it entirely and the system is no less safe.
 *
 * ── Responsive strategy ────────────────────────────────────────────────
 * One pattern, used once: desktop nav is `hidden md:flex`, the hamburger is
 * `md:hidden`, and the drawer panel is `md:hidden` with `absolute top-full`
 * inside a `relative` header. The header is `sticky`, so it is the containing
 * block for the absolutely-positioned panel without any extra wrapper.
 *
 * Duplicating the link list in both the desktop nav and the drawer is
 * deliberate. Sharing it costs a client-side array and re-derives it on every
 * render; duplicating three static links costs six lines of markup and
 * renders instantly. A shared nav config only earns its keep when the list
 * itself is dynamic — which, for a storefront, it is not.
 */

/** Small enough to inline. A `const` in a shared module would be identical. */

type StoreHeaderProps = {
  tenant: TenantBranding;
  categories: CategoryView[];
  /** null for an anonymous consumer. */
  role: TenantRole | null;
};

export function StoreHeader({ tenant, categories, role }: StoreHeaderProps) {
  const base = `/${tenant.slug}`;
  const hasCategories = categories.length > 0;

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60 relative">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px]">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href={base} className="flex items-center gap-2.5 group shrink-0 min-w-0">
            {/*
              The tenant's brand color, read from the CSS variable the layout
              set. This is the line that makes two clinics look like two
              different businesses from byte-identical code.
            */}
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[17px] text-white shadow-sm shrink-0"
              style={{ backgroundColor: "var(--tenant-primary)" }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </span>

            {/*
              `truncate` with `min-w-0` on the parent: a 40-character clinic
              name would otherwise push the nav off-screen on a phone. The
              flex item needs `min-w-0` to be allowed to shrink below its
              content width — the default `min-width: auto` prevents that.
            */}
            <span className="text-[17px] font-semibold text-foreground tracking-tight truncate">
              {tenant.name}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label="Main">
            <NavLink href={base} label="Home" />
            {hasCategories ? <NavLink href={`${base}/shop`} label="Shop" /> : null}
            {role ? (
              <NavLink href={`${base}/admin`} label="Admin" icon={<Lock className="w-3.5 h-3.5" />} />
            ) : null}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {role ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
                <ShieldCheck className="w-3 h-3" />
                {role}
              </span>
            ) : null}

            {hasCategories ? (
              <Link
                href={`${base}/shop`}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "var(--tenant-primary)" }}
              >
                Shop
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : null}

            <MobileNav tenant={tenant} categories={categories} role={role} />
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
    >
      {icon}
      {label}
    </Link>
  );
}

export function StoreFooter({ tenant }: { tenant: TenantBranding }) {
  return (
    <footer className="border-t border-border/60 mt-auto">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px] py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[13px] text-white"
              style={{ backgroundColor: "var(--tenant-primary)" }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-[14px] font-semibold text-foreground">
              {tenant.name}
            </span>
          </div>

          {/*
            The disclosure that this is a demo, stated plainly. It is also
            honest about the architecture: a visitor should know the
            storefront they are looking at is the same code as every other
            clinic's, with different config.
          */}
          <p className="text-[12px] text-muted-foreground">
            A storefront generated by{" "}
            <span className="font-medium text-foreground">Bask</span> — same
            infrastructure, your brand.
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * The tenant-controlled announcement bar.
 *
 * Returns null when `text` is null — not an empty bar. A config field left
 * blank should cost zero pixels, which is a small discipline that makes
 * multi-tenant UIs feel intentional rather than generic.
 */
export function AnnouncementBar({
  text,
  primaryColor,
}: {
  text: string | null;
  primaryColor: string;
}) {
  if (!text) return null;

  return (
    <div
      className="text-white text-[13px] font-medium text-center py-2.5 px-6"
      style={{ backgroundColor: primaryColor }}
    >
      <span className="inline-flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5" />
        {text}
      </span>
    </div>
  );
}
