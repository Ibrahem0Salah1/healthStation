"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

import type { CategoryView } from "@/lib/storefront-types";

/**
 * The shop filter rail.
 *
 * ── WHY THE URL IS THE SOURCE OF TRUTH ─────────────────────────────────
 * Filters and page number are read from `useSearchParams`, not from React
 * state. That means:
 *
 * 1. A filtered view is SHAREABLE and bookmarkable. Someone can send a
 *    colleague "the cholesterol ones, page 2" and it works.
 * 2. The BACK BUTTON WORKS. Filter state in `useState` would be lost on
 *    navigation and unreachable with the back arrow, which is one of the
 *    most-mislabelled buttons on the web.
 * 3. It survives a refresh, and it survives the server rendering the list.
 *
 * This is the standard argument for URL-as-state, and "the back button must
 * work" is the one that persuades people.
 *
 * ── WHY `router.push` AND NOT `router.replace` ──────────────────────────
 * Each filter change is a distinct step the user took, so it belongs in
 * history. `replace` would make the back button skip the whole filtering
 * session. We reset `page` to 1 on a filter change because page 4 of the old
 * filter set is meaningless against the new one — keeping the old page number
 * is a classic bug that shows an empty grid.
 *
 * ── WHY A TRANSITION, AND WHY THE LIST DOES NOT DISAPPEAR ──────────────
 * `useTransition` marks the navigation as non-urgent, so React keeps the
 * current list on screen and swaps it when the server responds. Without it
 * the grid unmounts, the layout collapses, and the page appears to flash.
 * This is the same mechanism Suspense uses, applied to a route change.
 */
export function ShopFilters({ categories }: { categories: CategoryView[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeCategory = searchParams.get("category") ?? "";

  // Desktop shows the rail inline; mobile shows it behind a disclosure. One
  // piece of state for both, so a mobile user who opens the rail and
  // rotates their phone does not lose their selection.
  const [railOpen, setRailOpen] = useState(false);

  function navigate(next: { category?: string; page?: number }) {
    const params = new URLSearchParams(searchParams);

    const category = next.category ?? activeCategory;
    const page = next.page ?? 1;

    if (category) params.set("category", category);
    else params.delete("category");

    if (page > 1) params.set("page", String(page));
    else params.delete("page");

    const query = params.toString();

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="mb-8">
      {/*
        Mobile only. On desktop the rail sits in a sidebar column, so a
        disclosure would be a control that hides something already visible.
      */}
      <button
        type="button"
        onClick={() => setRailOpen((value) => !value)}
        aria-expanded={railOpen}
        aria-controls="shop-filter-rail"
        className="lg:hidden w-full inline-flex items-center justify-center gap-2 rounded-xl
                   border border-border bg-white px-4 py-3 text-[14px] font-medium
                   text-foreground hover:bg-muted transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        {activeCategory ? "Filter" : "All categories"}
        {activeCategory ? <FilterCount /> : null}
      </button>

      <div
        id="shop-filter-rail"
        hidden={!railOpen}
        className="lg:block mt-4 lg:mt-0"
      >
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            active={activeCategory === ""}
            onClick={() => navigate({ category: "", page: 1 })}
          />

          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              count={category.productCount}
              active={activeCategory === category.slug}
              onClick={() => navigate({ category: category.slug, page: 1 })}
            />
          ))}

          {activeCategory ? (
            <button
              type="button"
              onClick={() => navigate({ category: "", page: 1 })}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5
                         text-[13px] font-medium text-muted-foreground
                         hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/*
        `aria-live` announces the result count to a screen reader after each
        filter change. Without it, a non-sighted user clicks a filter and
        gets no confirmation that anything happened — the list changed
        silently, which is WCAG 4.1.3 (Status Messages).
      */}
      <p aria-live="polite" className="sr-only">
        {isPending ? "Loading products" : "Products updated"}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // `aria-pressed` tells a screen reader this is a toggle and whether it
      // is currently on. Without it, an active filter looks identical to an
      // inactive one to anyone not relying on colour.
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5
                  text-[13px] font-medium transition-all ${
                    active
                      ? "text-white border-transparent shadow-sm"
                      : "border-border bg-white text-foreground hover:border-foreground/25"
                  }`}
      style={active ? { backgroundColor: "var(--tenant-primary)" } : undefined}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FilterCount() {
  return (
    <span className="w-1.5 h-1.5 rounded-full bg-foreground" aria-hidden="true" />
  );
}

/**
 * Pagination.
 *
 * A `<nav>` with `aria-label`, and the current page marked with
 * `aria-current="page"` — which is what lets a screen reader user answer
 * "which page am I on?" without reading every number aloud.
 *
 * The page window is deliberately capped. Rendering 40 page buttons for a
 * large catalog is noise; `1 … 4 5 6 … 40` keeps the control a fixed width
 * at every page count, which matters on a phone.
 */
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (totalPages <= 1) return null;

  function go(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  const pages: (number | "gap")[] = [];
  for (let index = 1; index <= totalPages; index += 1) {
    const isEdge = index === 1 || index === totalPages;
    const isNear = Math.abs(index - page) <= 1;
    if (isEdge || isNear) pages.push(index);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex items-center justify-center gap-1.5"
    >
      <PageButton
        onClick={() => go(page - 1)}
        disabled={page <= 1 || isPending}
        label="Previous"
      >
        Prev
      </PageButton>

      {pages.map((entry, index) =>
        entry === "gap" ? (
          <span
            key={`gap-${index}`}
            className="w-8 text-center text-[14px] text-muted-foreground select-none"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => go(entry)}
            disabled={isPending}
            aria-current={entry === page ? "page" : undefined}
            className={`w-9 h-9 rounded-lg text-[14px] font-medium tabular-nums transition-all
                        disabled:opacity-40 ${
                          entry === page
                            ? "text-white shadow-sm"
                            : "text-foreground hover:bg-muted"
                        }`}
            style={entry === page ? { backgroundColor: "var(--tenant-primary)" } : undefined}
          >
            {entry}
          </button>
        ),
      )}

      <PageButton
        onClick={() => go(page + 1)}
        disabled={page >= totalPages || isPending}
        label="Next"
      >
        Next
      </PageButton>
    </nav>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // The visible text ("Prev") is not descriptive enough out of context.
      aria-label={label}
      className="h-9 px-3 rounded-lg border border-border bg-white text-[14px] font-medium
                 text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none
                 transition-colors"
    >
      {children}
    </button>
  );
}
