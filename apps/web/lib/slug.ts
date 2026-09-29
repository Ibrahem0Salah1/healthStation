/**
 * ══════════════════════════════════════════════════════════════════════════
 * SHARED SLUG UTILITIES — used by BOTH the category and product routers
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Extracted out of `category-schema.ts` the moment a second consumer
 * (`product-schema.ts`) needed the exact same rules. Two copies of
 * "truncate to 80, ASCII, single hyphens" would start identical and drift the
 * first time one was tweaked.
 *
 * ── STOREFRONT-VISIBLE CAP ────────────────────────────────────────────────
 * Long enough for "Over-the-counter pain relief". Shared so a category name
 * and a product name can never fragment differently.
 */
export const SLUG_MAX = 80;

/**
 * Slugify a display name.
 *
 * Written for a pharmacy's real catalogue, so three details matter:
 *
 * 1. `NFKD` + stripping U+0300–U+036F removes diacritics, so "Dolor &
 *    Antalgiques" and "Douleur Café" produce ASCII slugs instead of
 *    percent-encoded noise. A pharmacy's catalogue is not ASCII — but URLs
 *    should be.
 *
 * 2. Every run of non-alphanumerics collapses to ONE hyphen. "Heart  Health"
 *    and "Heart-Health" must not become two different slugs.
 *
 * 3. Leading/trailing hyphens are stripped AFTER truncation, so a long name
 *    cannot end up as `"something-"`, which would be a valid-looking but
 *    ugly slug that also fails the input regex below.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}