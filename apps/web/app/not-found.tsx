import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * THE 404.
 *
 * Rendered for an unknown tenant slug, an unknown product, and an unknown
 * category — everything under `/{tenantSlug}/**` that calls `notFound()`.
 *
 * ── WHY THE LINKS ARE HARDCODED AND NOT TENANT-SLUGGED ─────────────────
 * This page is reached WHEN THE TENANT IS UNKNOWN. There is no slug to link
 * to — `params.tenantSlug` might be `cairo-herat` (a typo) or something a
 * crawler invented. Building `/${slug}/shop` links here would produce
 * 404-on-404: a 404 page full of broken links, which is the least helpful
 * thing a 404 can be.
 *
 * So it points at things that are guaranteed to exist: the platform home and
 * the login. The cost is that a visitor who mistyped one letter of a clinic
 * slug does not get a "did you mean" — Next.js does not have a
 * did-you-mean mechanism, and faking one with a substring query would be an
 * enumeration oracle (you could probe slug existence by reading whether the
 * page said "did you mean").
 */

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-[440px]">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
          <Compass className="w-6 h-6 text-muted-foreground" />
        </span>

        <h1 className="mt-7 text-[28px] font-medium tracking-[-0.03em] text-foreground">
          We couldn&apos;t find that page
        </h1>

        <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground text-pretty">
          The clinic you&apos;re looking for may not exist, or the link may be
          incomplete. Check the address, or start from the beginning.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-foreground text-background px-5 py-2.5 text-[14px] font-medium hover:bg-foreground/90 transition-colors"
          >
            Back to home
          </Link>

          <Link
            href="/login"
            className="rounded-full border border-border bg-white px-5 py-2.5 text-[14px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            Clinic owner login
          </Link>
        </div>
      </div>
    </main>
  );
}
