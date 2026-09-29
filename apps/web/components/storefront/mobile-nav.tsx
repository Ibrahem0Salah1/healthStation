"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Menu, X } from "lucide-react";

import type { CategoryView, TenantBranding, TenantRole } from "@/lib/storefront-types";

/**
 * THE ONLY CLIENT COMPONENT IN THE STOREFRONT HEADER.
 *
 * Everything else in the storefront is a Server Component, and this is the
 * one thing on a storefront page that genuinely needs browser state: a
 * disclosure. A hamburger menu is interactive by definition, so the smallest
 * correct island is the button plus the panel it controls.
 *
 * WHY NOT `<details>`/`<summary>`? It would ship zero JavaScript, which is
 * genuinely tempting. Two reasons it is the wrong call here:
 *
 * 1. NO ANIMATION CONTROL. You cannot animate the panel closing, and the
 *    "in:animate" transitions on the storefront grid and cards would then be
 *    the only motion on the page — an inconsistent feel.
 * 2. NO ESCAPE-TO-CLOSE, and no scroll lock. A drawer that leaves the
 *    background scrollable behind it is the most common mobile navigation
 *    bug on the web.
 *
 * So: one `"use client"` file. The header, the footer, the hero, the grid
 * and the product page all stay server-rendered and cost zero hydration.
 *
 * ── Accessibility, which is not optional for a nav ──────────────────────
 * - `aria-expanded` + `aria-controls` tell a screen reader the panel is a
 *   disclosure and whether it is open. Without them the menu is just a button.
 * - Escape closes it. A keyboard user who opens a drawer and cannot close it
 *   is trapped — this is a WCAG 2.1.2 failure, not a nicety.
 * - The background is scroll-locked while open, so the page behind does not
 *   move under the overlay.
 * - `md:hidden` hides it from the a11y tree and the visual tree together at
 *   the same breakpoint, so the two never disagree.
 */

export function MobileNav({
  tenant,
  categories,
  role,
}: {
  tenant: TenantBranding;
  categories: CategoryView[];
  role: TenantRole | null;
}) {
  const pathname = usePathname();

  /*
   * THE DRAWER'S OPEN STATE IS DERIVED, NOT SYNCHRONISED.
   *
   * The obvious implementation is `useState<boolean>` plus an effect that
   * closes the drawer when `pathname` changes. That is wrong, and React's
   * lint rule `react-hooks/set-state-in-effect` is right to flag it: setting
   * state in an effect body causes a second render pass on every navigation,
   * and it stores something the component could have computed.
   *
   * `openedFor` holds the PATHNAME the drawer was opened at. The drawer is
   * open exactly when that still matches the current pathname:
   *
   *     open === openedFor === pathname
   *
   * So navigation closes the drawer for free, as a consequence of the
   * derivation, with no effect, no extra render, and no chance of the two
   * getting out of sync. This is the "you might not need an effect" rule
   * from the React docs, and it is worth recognising the shape: when you
   * catch yourself syncing state to a prop, you usually want to store the
   * prop instead.
   */
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const open = openedFor === pathname;

  function close() {
    setOpenedFor(null);
  }

  function toggle() {
    setOpenedFor(open ? null : pathname);
  }

  const base = `/${tenant.slug}`;

  const links = [
    { label: "Home", href: base },
    ...(categories.length > 0 ? [{ label: "Shop", href: `${base}/shop` }] : []),
    ...(role ? [{ label: "Admin", href: `${base}/admin`, icon: true }] : []),
  ];

  /* Escape to close, and lock the background while open. */
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="storefront-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center rounded-lg
                   text-foreground hover:bg-muted transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/*
        The backdrop. `fixed inset-0` with a negative z-index places it
        BEHIND the header (z-50) but in front of the page content, which is
        what makes tapping outside close the drawer without a click handler on
        the overlay itself.
      */}
      {open ? (
        <div
          className="md:hidden fixed inset-0 -z-10 bg-foreground/20 backdrop-blur-[2px]"
          onClick={close}
          aria-hidden="true"
        />
      ) : null}

      <div
        id="storefront-mobile-nav"
        hidden={!open}
        className="md:hidden absolute top-full inset-x-0 z-50
                   bg-background border-b border-border shadow-lg
                   max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain"
      >
        <nav className="px-6 py-4 flex flex-col" aria-label="Mobile">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 py-3.5 border-b border-border/60
                         text-[15px] font-medium text-foreground last:border-b-0
                         hover:text-muted-foreground transition-colors"
            >
              {"icon" in link && link.icon ? <Lock className="w-4 h-4" /> : null}
              {link.label}
            </Link>
          ))}

          {categories.length > 0 ? (
            <div className="pt-4">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground mb-2">
                Categories
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`${base}/category/${category.slug}`}
                    className="rounded-lg border border-border bg-white px-3 py-1.5
                               text-[13px] font-medium text-foreground
                               hover:border-foreground/20 transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </nav>
      </div>
    </>
  );
}
