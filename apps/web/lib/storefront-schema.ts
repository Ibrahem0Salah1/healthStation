import { z } from "zod";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * THE SHARED STOREFRONT SCHEMA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This file is imported by BOTH:
 *
 *   1. `server/routers/tenant.ts`  → the authoritative control
 *   2. `components/admin/storeFrontAdminForm.tsx` → `zodResolver` for the forms
 *
 * WHY ONE FILE AND NOT TWO COPIES
 *
 * The rules below are security controls, not preferences. If the client kept
 * its own copy and the server kept its own, they would agree today and drift
 * the first time someone loosened one. Then a hand-crafted request — `curl`,
 * or a browser with validation disabled — would hit the looser server and the
 * UI would be lying about what the endpoint accepts.
 *
 * The client copy is for FEEDBACK. This copy is the CONTROL. Same file, so
 * they cannot disagree.
 *
 * The subtlety: `zodResolver` on the client is an optimisation for the owner's
 * time, nothing more. Someone can always post directly to
 * `/api/trpc/storefront.update` and bypass every client check, which is why
 * `storefront.update` runs this schema again on the server.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY A `#` AND SIX HEX DIGITS IS THE ONLY SAFE COLOUR
 *
 * `primaryColor` is written into a `style` attribute by the tenant layout:
 *
 *     <div style="--tenant-primary: #B91C1C">
 *
 * The string `red; } body { display:none }` is perfectly valid input for a
 * text field and a broken stylesheet for a browser. Anchoring the value with
 * `#` and exactly six hex digits is the only shape that survives being
 * interpolated into a CSS custom property.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY `ctaHref` REJECTS `https://evil.test` *AND* `//evil.test`
 *
 * A full URL would let a tenant point their call-to-action at a phishing page
 * and spend THIS domain's credibility doing it.
 *
 * The leading `/` anchors the link inside the tenant's own subtree. That check
 * alone is not enough: `//evil.test` starts with a slash, and a browser reads
 * it as a protocol-relative URL pointing off-domain. The negative lookahead
 * `(?!\/)` closes that second door.
 *
 * The third door is the character class. No `:` means no `javascript:` and no
 * `data:` scheme, and no whitespace or quotes means nothing can break out of
 * the `href="…"` attribute.
 */

/** The hero block. Shared by the hero form and the full-config input. */
export const heroSchema = z.object({
  headline: z
    .string()
    .trim()
    .min(1, "Give your hero a headline")
    .max(90, "Keep the headline under 90 characters"),
  subheadline: z
    .string()
    .trim()
    .min(1, "Add a subheadline")
    .max(160, "Keep the subheadline under 160 characters"),
  ctaLabel: z
    .string()
    .trim()
    .min(1, "Label your button")
    .max(30, "Keep the button label under 30 characters"),
  ctaHref: z
    .string()
    .trim()
    .regex(
      /^\/(?!\/)[a-zA-Z0-9\-_/.]*$/,
      "Use a path inside your storefront, like /shop",
    ),
});

/** The theme block. Shared by the theme form and the full-config input. */
export const themeSchema = z.object({
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #B91C1C"),
  fontFamily: z.enum(["sans", "serif"]),
  showTrustBadges: z.boolean(),
});

/**
 * THE WHOLE CONFIG — the input for `storefront.update`.
 *
 * `.strict()`: an unknown key is a 400 rather than being merged into the jsonb
 * column. Without it a client could post `{...config, isAdmin:true}` and have
 * the extra key persisted, then rely on some later `jsonb ->>` read trusting
 * it. Unknown keys are a bug, and the cheapest way to find one is to reject it.
 *
 * The object is REQUIRED, not `.partial()`. `config` is a single jsonb column,
 * so writing it REPLACES the entire blob. A partial input would silently erase
 * every section the client forgot to send. The client sends the whole object
 * and the server never guesses at a merge.
 */
export const storefrontConfigSchema = z
  .object({
    hero: heroSchema,
    theme: themeSchema,
    announcement: z.string().trim().max(200, "Keep the announcement under 200 characters").nullable(),
    showCategories: z.boolean(),
  })
  .strict();

/**
 * The input shape for `storefront.update`.
 *
 * `tenantSlug` is re-declared even though `adminProcedure` already declares it
 * in a chained `.input()`. This is NOT redundant, and the reason is a genuine
 * tRPC v11 trap.
 *
 * Chaining `.input()` INTERSECTS THE TYPES but keeps only the LAST parser at
 * runtime. Inside the resolver `input.tenantSlug` typechecks, so the code
 * reads like a merge — but if this schema were `.strict()` and omitted the key,
 * the server would answer `Unrecognized key: "tenantSlug"` and HTTP 400. A
 * type-level lie: it compiles, the type-driven tests pass, and the bug appears
 * only over the wire.
 *
 * Declaring it here is the fix. See `category-schema.ts` for the full note.
 */
export const storefrontUpdateInputSchema = z.object({
  tenantSlug: z.string().min(1),
  config: storefrontConfigSchema,
});

export type StorefrontHeroValues = z.infer<typeof heroSchema>;
export type StorefrontThemeValues = z.infer<typeof themeSchema>;
export type StorefrontConfigInput = z.infer<typeof storefrontConfigSchema>;

/**
 * THE SECTIONS FORM IS INTENTIONALLY NOT HERE.
 *
 * Its fields do not map 1:1 to the stored config. The form works in
 * `announcementEnabled: boolean` + `announcement: string`, because a checkbox
 * plus a text box is a better control than a nullable text field where blank
 * and "off" mean different things.
 *
 * That `string -> string | null` translation is a UI decision, so it belongs
 * next to the checkbox that causes it — inside the form — rather than in a
 * shared contract that the server would then have to honour. The server still
 * validates the real shape via `storefrontConfigSchema`.
 */
export const sectionsFormSchema = z.object({
  showCategories: z.boolean(),
  announcementEnabled: z.boolean(),
  announcement: z.string().trim().max(200, "Keep the announcement under 200 characters"),
});

export type StorefrontSectionsValues = z.infer<typeof sectionsFormSchema>;
