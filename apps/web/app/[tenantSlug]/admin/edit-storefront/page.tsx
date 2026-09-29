import { notFound } from "next/navigation";

import { StorefrontAdminForm } from "@/components/admin/storeFrontAdminForm";
import { AdminPageHeader } from "@/components/admin/shell";
import { api } from "@/server/caller";

/**
 * `/admin/edit-storefront` — the config editor.
 *
 * This screen is the justification for the JSONB `config` column. Every field
 * here changes what the public storefront looks like, with no deploy, no
 * migration, and no code change.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS PAGE IS A SERVER COMPONENT
 *
 * It reads the config with NO client fetch. The values arrive in the initial
 * HTML, so the form is populated on first paint — no spinner, no layout shift,
 * and it works if JavaScript fails to load at all. Only the interactive island
 * (`<StorefrontAdminForm>`) needs a click handler, and it receives plain
 * serialisable props.
 *
 * This is the pattern for the rest of the admin: pages fetch on the server,
 * interactive leaves fetch on the client.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY `api()` AND NOT A tRPC CLIENT
 *
 * `api()` is `appRouter.createCaller(ctx)`: the SAME router, the SAME
 * middleware chain, the SAME Zod input parsing, without a network round trip to
 * ourselves. It is NOT a privileged shortcut.
 *
 * That distinction is the security point. The admin LAYOUT already ran
 * `checkRole()` and would have rendered `<NoAccess>` for a non-member, so a
 * reader may reasonably assume this page is unprotected. It is not — it is
 * protected by `adminProcedure`'s `hasRole("owner","admin")`, which runs again
 * inside the caller. The layout check is user experience; this one is the
 * control. Two independent checks means a mistake in either one is not a breach.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE THREE FIELDS NEED CONSTRAINTS
 *
 * These are security controls, not preferences, and they live in
 * `lib/storefront-schema.ts` — the file shared by this page's forms and the
 * router, so the two cannot drift:
 *
 * 1. `primaryColor`  →  /^#[0-9a-fA-F]{6}$/
 *    Written into a `style` attribute by the tenant layout. Without the
 *    constraint, `red; } body { display:none }` is valid input for a text field
 *    and a broken stylesheet to a browser.
 *
 * 2. `ctaHref`  →  /^\/(?!\/)[a-zA-Z0-9\-_/.]*$/
 *    A full URL would let a tenant aim their call-to-action at a phishing page
 *    and spend THIS domain's credibility doing it. The leading slash anchors
 *    the link inside the tenant's own subtree; the lookahead rejects the
 *    protocol-relative `//evil.test`, which would otherwise pass a naive
 *    leading-slash check.
 *
 * 3. `announcement`  →  .max(200).nullable()
 *    A one-line strip, and a tenant-controlled string that has to earn its
 *    place in the layout.
 *
 * The client runs the same rules for instant feedback. The server runs them
 * again because a browser can be bypassed, and that second run is the only one
 * that counts.
 */
export default async function AdminEditStorefrontPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  /**
   * `api()` is `cache(async …)`, so it hands back a PROMISE of a caller — the
   * `await` is required, and the result is memoised per request, so the
   * tenant LAYOUT that already called `api()` reuses this exact context rather
   * than reading the session cookie twice.
   */
  const caller = await api();
  const config = await caller.storefront.get({ tenantSlug });

  if (!config) notFound();

  return (
    <>
      <AdminPageHeader
        title="Storefront"
        description="Branding and copy for your public storefront."
      />

      <StorefrontAdminForm tenantSlug={tenantSlug} initial={config} />

      {/*
        A live summary of the SAVED values, so the owner is not saving blind.

        A static summary rather than an iframe: an iframe would load the whole
        storefront to display one section, and it would not reflect an unsaved
        edit anyway — which makes it worse than useless here.

        This renders the SERVER's config, not the editor's state, so it updates
        after a save because `router.refresh()` re-ran this page. That is the
        Next router cache, not React Query — the same two-cache distinction the
        form's `onSuccess` handles.
      */}
      <div className="max-w-[720px] mt-6 rounded-2xl border border-border/60 p-5">
        <h2 className="text-[13px] font-semibold tracking-wider uppercase text-muted-foreground">
          Current copy
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="text-[12px] text-muted-foreground">Headline</p>
            <p className="mt-1 text-[18px] font-medium tracking-[-0.02em] text-foreground">
              {config.hero.headline}
            </p>
          </div>

          <div>
            <p className="text-[12px] text-muted-foreground">Subheadline</p>
            <p className="mt-1 text-[14px] text-foreground">{config.hero.subheadline}</p>
          </div>

          <div className="flex items-center gap-4">
            <span
              className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: config.theme.primaryColor }}
            >
              {config.hero.ctaLabel}
            </span>
            <code className="font-mono text-[12px] text-muted-foreground">
              /{tenantSlug}
              {config.hero.ctaHref}
            </code>
          </div>

          {config.announcement ? (
            <div>
              <p className="text-[12px] text-muted-foreground">Announcement</p>
              <p
                className="mt-1.5 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white"
                style={{ backgroundColor: config.theme.primaryColor }}
              >
                {config.announcement}
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No announcement bar is showing.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
