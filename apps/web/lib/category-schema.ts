import { z } from "zod";

import { SLUG_MAX as SLUG_MAX_SHARED, slugify as slugifyShared } from "./slug";

/**
 * Re-exported so existing importers of `@/lib/category-schema` keep working,
 * and so the product schema imports ONE slug implementation.
 */
export const SLUG_MAX = SLUG_MAX_SHARED;
export const slugify = slugifyShared;

/**
 * ══════════════════════════════════════════════════════════════════════════
 * CATEGORY VALIDATION — shared by the router and the admin form
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Same arrangement as `storefront-schema.ts`: one file, imported by the server
 * (the control) and by the client form (the feedback). They cannot drift.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT IS *NOT* IN THE INPUT, AND WHY THAT IS THE POINT
 *
 * `sortOrder` is absent. The owner types a NAME; the server decides the
 * position.
 *
 * A client-supplied order is a client-supplied race. Two owners saving at the
 * same moment both read "the current max is 4", both write 5, and you get two
 * categories claiming the same slot with no error anywhere — the list renders,
 * the order is just quietly wrong, and it is unreproducible. Removing the
 * field from the input schema makes that bug unexpressible rather than
 * merely discouraged.
 *
 * The same reasoning retires the client's ability to set `tenantId`: the row
 * is written against `ctx.tenant.id`, resolved server-side from the slug.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY A SLUG IS NOT A SECURITY BOUNDARY HERE
 *
 * Worth being precise, because the storefront file uses stronger language
 * about its fields and it would be easy to over-claim here.
 *
 * A category slug is interpolated into a URL path and compared against a
 * unique index. It is always passed to Drizzle as a BOUND PARAMETER, so SQL
 * injection is already impossible regardless of its contents. The charset
 * restriction below is therefore a UX and hygiene rule — it keeps URLs
 * predictable, avoids percent-encoding surprises and unicode homoglyphs in a
 * path segment, and matches what the admin UI advertises.
 *
 * It is NOT the control that matters here. The controls that matter are:
 *   1. `tenantId` comes from `ctx`, never from the input
 *   2. `adminProcedure` proves membership before the insert runs
 *   3. `categories_tenant_slug_uidx` — the composite (tenant_id, slug) index —
 *      is the actual uniqueness guarantee, and it is race-proof
 */

/** Storefront-visible cap. Long enough for "Over-the-counter pain relief". */
const NAME_MAX = 80;

/**
 * The form's own schema.
 *
 * Distinct from the router's input schema on purpose: the form needs a blank
 * slug to be VALID (the UI says "leave blank to generate one"), whereas the
 * router's input has already had that blank resolved into a real slug.
 */
export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the category a name")
    .max(NAME_MAX, `Keep the name under ${NAME_MAX} characters`),
  slug: z
    .string()
    .trim()
    .max(SLUG_MAX, `Keep the slug under ${SLUG_MAX} characters`)
    .refine(
      (value) => value === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
      "Use lowercase letters, numbers and single hyphens",
    ),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

/**
/**
 * The router's input for `category.create`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY `tenantSlug` IS DECLARED HERE AND NOT INHERITED FROM `adminProcedure`
 *
 * This is a genuine tRPC v11 trap, and the type system actively hides it.
 *
 * `adminProcedure` already declares `.input(tenantSlugSchema)`. Chaining a
 * second `.input()` INTERSECTS the TYPES:
 *
 *     ProcedureBuilder<..., IntersectIfDefined<TInputIn, ...>, ...>
 *                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *
 * So inside the resolver, `input.tenantSlug` typechecks and `input.name`
 * typechecks. It looks exactly like a merge.
 *
 * At RUNTIME it is not a merge. The procedure keeps ONE parser - the last one
 * declared. Give that parser `.strict()` and the declared-but-unvalidated
 * `tenantSlug` becomes an unknown key:
 *
 *     Unrecognized key: "tenantSlug"      -> HTTP 400
 *
 * That is a type-level lie: the editor says the key is part of the input, and
 * the server rejects it at runtime. It is the worst failure mode available,
 * because the code compiles, the tests written against the type pass, and the
 * bug only appears over HTTP.
 *
 * The rule, then: EVERY procedure input declares `tenantSlug` itself. It is
 * duplicated on purpose. It costs one line and removes an entire class of
 * "it typechecks but 400s" confusion.
 *
 * Note `storefrontUpdateInputSchema` does exactly the same thing, which is why
 * the storefront update works. The comment there used to claim tRPC merged the
 * schemas; it does not.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `.strict()`, matching `storefrontConfigSchema`. An unknown key is a 400
 * rather than a silent strip, which is worth it here specifically because
 * `sortOrder` is a field a client would plausibly send: it is in the database
 * and the UI shows it. A client that posts it gets a loud, debuggable error
 * instead of a save that looks like it worked and quietly ignored them.
 */
export const categoryCreateInputSchema = z
  .object({
    tenantSlug: z.string().min(1),
    name: z
      .string()
      .trim()
      .min(2, "Give the category a name")
      .max(NAME_MAX, `Keep the name under ${NAME_MAX} characters`),
    /**
     * Optional. Blank means "derive it from the name". Whatever arrives is
     * re-normalised through the same rules, so a hand-typed `Heart--Health` or
     * `  heart health  ` cannot create a slug the UI would never have produced.
     */
    slug: z
      .string()
      .trim()
      .max(SLUG_MAX)
      .optional()
      .transform((value) => (value ? slugify(value) : undefined)),
  })
  .strict();

export type CategoryCreateInput = z.infer<typeof categoryCreateInputSchema>;

/**
 * The router's input for `category.getBySlug`.
 *
 * Query-only, so deliberately not `.strict()` — an unnoticed extra key is a
 * no-op here, and a forward-compatible query should not hard-400.
 */
export const categoryGetBySlugInputSchema = z.object({
  tenantSlug: z.string().min(1),
  categorySlug: z.string().min(1),
});
