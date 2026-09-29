import Link from "next/link";
import {
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  Tags,
} from "lucide-react";

import { AdminNavLink } from "@/components/admin/nav-link";
import type { TenantBranding, TenantRole } from "@/lib/storefront-types";

/**
 * THE ADMIN SHELL — sidebar navigation.
 *
 * A Server Component. Everything here is static chrome: no active-link
 * highlighting, no user menu, no confirmation dialogs. Adding interactivity
 * to the shell would drag the whole sidebar into the client bundle, so the
 * ONE interactive piece — knowing which nav item is current — is isolated in
 * `nav-link.tsx`.
 *
 * ── WHY THE NAV IS AN ARRAY AND NOT HARD-CODED JSX ──────────────────────
 * Four entries with an icon, a label and an href is a data structure, and
 * rendering it with `.map()` is shorter than four hand-written blocks that
 * must stay in the same order as the pages they link to. The cost is that
 * the icon is a component reference rather than JSX, which is fine — they
 * are stored in a module-level constant, so nothing is constructed per
 * render.
 *
 * `end: true` on the dashboard link is the important detail. Without it,
 * `/clinic/admin` counts as "active" on EVERY admin page, because a prefix
 * match on `/admin` is also true for `/admin/products`. The dashboard would
 * look selected on every screen.
 */

const NAV_ITEMS = [
  { href: "", label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: "/products", label: "Products", icon: Package, end: false },
  { href: "/categories", label: "Categories", icon: Tags, end: false },
  { href: "/edit-storefront", label: "Storefront", icon: Palette, end: false },
] as const;

export function AdminNav({ tenant }: { tenant: TenantBranding }) {
  const base = `/${tenant.slug}/admin`;

  return (
    <nav
      aria-label="Admin"
      className="flex md:flex-col gap-1 overflow-x-auto
                 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <AdminNavLink
          key={item.label}
          href={`${base}${item.href}`}
          end={item.end}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {item.label}
        </AdminNavLink>
      ))}
    </nav>
  );
}

/**
 * The admin header.
 *
 * `role` is displayed, never checked, here. The check happened in
 * `requireRole()` in the admin layout before this component ever rendered —
 * this is a label telling the owner what their permissions are, not a
 * control. Anyone who edits this to be a control has misread the layering.
 */
export function AdminHeader({
  tenant,
  role,
}: {
  tenant: TenantBranding;
  role: TenantRole;
}) {
  return (
    <header className="border-b border-border/60 bg-background/85 backdrop-blur-md sticky top-0 z-30">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px] h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[14px] text-white shrink-0"
            style={{ backgroundColor: "var(--tenant-primary)" }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-foreground truncate leading-tight">
              {tenant.name}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Admin · {role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/*
            "View storefront" is an EDITORIAL link, not a security control.
            It points at a public page. Anyone with the URL can reach it; the
            link just saves typing. Worth saying out loud, because it is the
            clearest example in the app of a link that looks privileged and
            is not.
          */}
          <Link
            href={`/${tenant.slug}`}
            className="hidden sm:inline-flex items-center rounded-full border border-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            View storefront
          </Link>

          {/*
            Logout is a `<form action>` pointing at the existing
            `/api/auth/logout` route handler — NOT a tRPC mutation.
            It sets an httpOnly cookie, so only the server can do it, and a
            Server Action or a route handler is the only way. This is the same
            rule as login and signup: route handlers own the credential
            exchange.
          */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/**
 * The page heading used across every admin screen.
 *
 * A component rather than a repeated block because the "title + description
 * + action on the right" arrangement is identical on four pages, and the
 * responsive part is easy to get subtly wrong each time (`flex-col
 * sm:flex-row` plus `sm:items-center`, so the action button is not
 * centre-aligned against a two-line title on a phone).
 */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h1 className="text-[24px] md:text-[28px] font-medium tracking-[-0.025em] text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-[14px] text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
