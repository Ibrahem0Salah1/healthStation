"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * ONE link in the admin sidebar, and the only client component in the admin
 * shell.
 *
 * ── WHY IT IS SPLIT OUT ─────────────────────────────────────────────────
 * Highlighting the current page needs `usePathname()`. A hook makes the file
 * a Client Component, and the boundary propagates DOWN — so if this hook
 * lived in `shell.tsx`, the whole sidebar, the header and the sign-out form
 * would ship to the browser. Four links do not justify hydrating the entire
 * admin chrome. One link with the hook is a few hundred bytes.
 *
 * This is the same island discipline as the storefront: server-render
 * everything, isolate the smallest thing that genuinely needs browser state.
 *
 * ── THE ACTIVE-MATCH RULE, AND WHY `end` MATTERS ────────────────────────
 * `end === true` means EXACT match. `end === false` means PREFIX match.
 *
 * Without this distinction, `/cairo-heart/admin` is a prefix of
 * `/cairo-heart/admin/products`, so the Dashboard would render as active on
 * the products page. Both would highlight, or neither would. The dashboard
 * is the one item that needs an exact match because its path is a strict
 * prefix of every other item's.
 *
 * ── `usePathname()` EXCLUDES THE QUERY STRING ──────────────────────────
 * It returns only the path. That is what you want: an admin list filtered by
 * `?category=cholesterol` should still show Products as active. Comparing
 * against `useSearchParams()` would lose the highlight the moment a filter
 * was applied.
 *
 * ── `aria-current` IS NOT OPTIONAL ──────────────────────────────────────
 * Colour alone does not convey state. A screen reader user navigating by
 * link needs `aria-current="page"` to answer "where am I?" — a sighted user
 * gets that from the background colour, and this is the equivalent.
 */
export function AdminNavLink({
  href,
  end,
  children,
}: {
  href: string;
  end: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = end ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium
                  transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? "text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
      style={isActive ? { backgroundColor: "var(--tenant-primary)" } : undefined}
    >
      {children}
    </Link>
  );
}
