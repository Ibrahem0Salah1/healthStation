import { z } from "zod";

import { slugify, SLUG_MAX } from "./slug";
import { inputToCents } from "./money";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * PRODUCT VALIDATION — shared by the router and the admin form
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Same arrangement as `category-schema.ts`: one file, imported by the server
 * (the control) and by the client form (the feedback). They cannot drift.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT IS *NOT* IN THE INPUT, AND WHY THAT IS THE POINT
 *
 * `tenantId` and `sortOrder` are absent, exactly as in the category schema.
 * The row is written against `ctx.tenant.id`, and the owner never chooses a
 * position — the server appends. `currency` is also absent: there is no UI for
 * it, it is seeded as `"USD"`, and letting a request body name a currency the
 * form cannot produce would be a client-supplied inconsistency.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE TWO SHAPES, AND WHY THEY DIFFER
 *
 * `productFormSchema` is the FORM. Its `price` field is a STRING — the owner
 * types "48.50" — and `activeIngredients` is one comma-separated STRING, because
 * one text input beats an array editor. The round-trip into integers happens in
 * the browser (`inputToCents`, `lib/money.ts`), so the float never crosses the
 * wire and the server only ever receives `priceCents: 4850`.
 *
 * `productCreateInputSchema` / `productUpdateInputSchema` are the ROUTER. They
 * are `.strict()` — here, unlike a query, an unknown key is worth a loud 400,
 * because the tempting overflow keys (`sortOrder`, `tenantId`, `currency`) live
 * in the database and a client that posts them must be told loudly that they
 * were not honoured.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY `categoryId` IS A UUID/Null HERE BUT A STRING IN THE FORM
 *
 * The form sends `""` for "no category" — it cannot send null through a
 * `<select>`. The empty string is converted to null at the submit boundary in
 * the component, so the server schema is the honest shape: a category id or
 * nothing. `z.string().uuid()` also rejects a hand-typed `"c4"` (the mock's id)
 * before any SQL runs.
 *
 * WHETHER THE CATEGORY BELONGS TO THIS TENANT is a SERVER check, in the router.
 * The FK alone is not enough: it proves a category row exists somewhere, not
 * that it is this clinic's. See `product.create` in the router.
 */

/** Storefront-visible caps. A name can be long; a URL slug cannot. */
export const PRODUCT_NAME_MAX = 120;
export const SUMMARY_MAX = 200;
export const DESCRIPTION_MAX = 4000;
export const PACK_SIZE_MAX = 100;
export const INGREDIENT_MAX = 80;
export const INGREDIENTS_MAX_COUNT = 30;

/**
 * The largest price an owner can set: $1,000,000 in cents.
 *
 * `priceCents` is an `integer` column (Postgres max ~2.1 billion); the cap is
 * far below that but far above any pharmacy catalog line, and it keeps a
 * 9-digit typo from becoming a 4096-dollar product with a silent sign loss.
 */
export const PRICE_CENTS_MAX = 100_000_000;

/**
 * The image address rule, applied by both the form and the router, through the
 * shared predicate `isAllowedImageUrl` so the two cannot drift.
 *
 * TWO shapes are allowed, and only these:
 *
 *   1. A server-relative path: `/products/monitor.png`, served from this
 *      app's own `public/` folder.
 *   2. An absolute `https://` URL, for images hosted off this app — e.g. the
 *      R2 bucket: `https://<bucket>.r2.dev/products/<key>.jpg`.
 *
 * Shape 2 is new. The original rule was path-only, on the theory that a full
 * URL lets a tenant point your visitors' browsers at their own server on
 * every render. That cost is real but it is the price of using a CDN, and R2
 * (or any CDN) is exactly what a product photo belongs on — the `public/`
 * folder is not built to be a storage service. So the ban is narrowed instead
 * of lifted: an absolute URL must be `https://` (never `http://`, which any
 * middlebox between the visitor and the origin could swap for a payload of
 * its choice), must not carry credentials, and must be parseable by a URL
 * parser — which excludes `javascript:`, `data:`, `file:` and protocol-
 * relative `//host` in one move.
 *
 * These are `<img src>` values, so they flow into an already-escaped
 * attribute at render time; the https-only rule is defence against a
 * photographed page's trust being spent on a scheme that can execute, not a
 * boundary against remote images. The empty string is explicitly allowed and
 * becomes `null` before it leaves the schema: this is how "clear the image"
 * is expressed.
 */
const IMAGE_ADDRESS_MAX = 2048;

/** True for the empty string, a server-relative path, or a safe absolute https URL. */
export function isAllowedImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || isPublicImagePath(trimmed) || isSafeImageUrl(trimmed);
}

/** `\/(?!\/)` — starts with a single slash, no protocol-relative `//host`. The
 * character class has no whitespace, quotes or `:`, so nothing here can break
 * out of an attribute or smuggle a scheme. */
function isPublicImagePath(value: string): boolean {
  return /^\/(?!\/)[a-zA-Z0-9\-_/.]+$/.test(value);
}

/** An absolute https URL. `new URL` runs in both Node and the browser, so the
 * client form and the server router apply literally the same parse. */
function isSafeImageUrl(value: string): boolean {
  if (/[\s<>'"]/.test(value)) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  // `user:pass@` in an `<img src>` would make the browser honour committed
  // credentials at an attacker-chosen host, and no legitimate CDN URL has them.
  if (url.username !== "" || url.password !== "") return false;
  // A dot keeps `localhost`-style internal names out of a stored address.
  if (!url.hostname.includes(".")) return false;

  return true;
}

const imagePathSchema = z
  .string()
  .trim()
  .max(IMAGE_ADDRESS_MAX, `Keep the image address under ${IMAGE_ADDRESS_MAX} characters`)
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || isAllowedImageUrl(value),
    "Use a path inside your public folder (like /products/monitor.png) or a direct https:// image URL (like your R2 bucket).",
  );

/**
 * The integer money the wire carries.
 *
 * `.int()` + `.max(PRICE_CENTS_MAX)` are the server-side backstop to the form's
 * `inputToCents` round: someone can always bypass the browser, and a float or a
 * 9-digit number must be rejected here, in the single place the server can.
 */
export const priceCentsSchema = z
  .number("Price must be a number")
  .int("Price must be a whole number of cents")
  .min(0, "Price cannot be negative")
  .max(PRICE_CENTS_MAX, `Price cannot exceed $${(PRICE_CENTS_MAX / 100).toLocaleString("en-US")}`);

/**
 * `activeIngredients` as the DATABASE sees it: an array.
 *
 * The form's comma string is split into this by the component. Range checks
 * bound both ends — empty is legal (a monitor has no actives), but 300 items
 * is a paste bug, not a product.
 */
export const activeIngredientsSchema = z
  .array(z.string().trim().min(1).max(INGREDIENT_MAX, `Keep each ingredient under ${INGREDIENT_MAX} characters`))
  .max(INGREDIENTS_MAX_COUNT, `At most ${INGREDIENTS_MAX_COUNT} ingredients`);

/**
 * The fixed platform shape, mirroring `ProductDetails` in `@repo/database`.
 *
 * `.strict()`: these fields are a fixed contract (`FEATURES.md` §5.2), so any
 * unknown key inside `details` is a drift bug and should fail loudly rather
 * than being persisted into the jsonb column.
 */
export const productDetailsSchema = z
  .object({
    packSize: z
      .string()
      .trim()
      .min(1, "Set a pack size")
      .max(PACK_SIZE_MAX, `Keep the pack size under ${PACK_SIZE_MAX} characters`),
    activeIngredients: activeIngredientsSchema,
    generic: z.boolean(),
    requiresPrescription: z.boolean(),
  })
  .strict();

/** Blank means "derive it". Whatever arrives is re-normalised. */
const slugFieldSchema = z
  .string()
  .trim()
  .max(SLUG_MAX, `Keep the slug under ${SLUG_MAX} characters`)
  .optional()
  .transform((value) => (value ? slugify(value) : undefined));

const nameSchema = z
  .string()
  .trim()
  .min(2, "Give the product a name")
  .max(PRODUCT_NAME_MAX, `Keep the name under ${PRODUCT_NAME_MAX} characters`);

const summarySchema = z
  .string()
  .trim()
  .min(10, "Write a short summary of what this product is")
  .max(SUMMARY_MAX, `Keep the summary under ${SUMMARY_MAX} characters`);

const descriptionSchema = z
  .string()
  .trim()
  .min(20, "Add a fuller description")
  .max(DESCRIPTION_MAX, `Keep the description under ${DESCRIPTION_MAX} characters`);

/**
 * The fields a create and an update share, described once so the two inputs
 * cannot drift. `isActive` is deliberately NOT here: create defaults it to
 * true, update requires it (the edit form always sends it).
 */
const productFields = {
  name: nameSchema,
  slug: slugFieldSchema,
  summary: summarySchema,
  description: descriptionSchema,
  priceCents: priceCentsSchema,
  /** A category id, or null. Whether it belongs to THIS tenant is a router check. */
  categoryId: z.string().uuid("Invalid category id").nullable(),
  imageUrl: imagePathSchema,
  details: productDetailsSchema,
};

/**
 * The router's input for `product.create`.
 *
 * Every field is server-decided or validated here; the client contributes
 * content and nothing else. `.strict()` makes posting a `tenantId` or
 * `sortOrder` a loud 400.
 */
export const productCreateInputSchema = z
  .object({
    tenantSlug: z.string().min(1),
    ...productFields,
    isActive: z.boolean().default(true),
  })
  .strict();

export type ProductCreateInput = z.infer<typeof productCreateInputSchema>;

/** The router's input for `product.update`. Adds the immutable row key. */
export const productUpdateInputSchema = z
  .object({
    tenantSlug: z.string().min(1),
    productId: z.string().uuid("Invalid product id"),
    ...productFields,
    isActive: z.boolean(),
  })
  .strict();

export type ProductUpdateInput = z.infer<typeof productUpdateInputSchema>;

/** The router's input for `product.setActive` — a visibility-only write. */
export const productSetActiveInputSchema = z
  .object({
    tenantSlug: z.string().min(1),
    productId: z.string().uuid("Invalid product id"),
    isActive: z.boolean(),
  })
  .strict();

export type ProductSetActiveInput = z.infer<typeof productSetActiveInputSchema>;

/* ──────────────────────────────────────────────────────────────────────────
 * QUERY INPUTS. Not `.strict()`: a query cannot write, so an unnoticed extra
 * key is a silently-stripped no-op rather than a data hazard. The discipline
 * of `.strict()` pays for itself on writes and costs nothing on reads, but it
 * turns a forward-compatible query into a hard 400 for no security gain.
 * ──────────────────────────────────────────────────────────────────────── */

export const productListInputSchema = z.object({
  tenantSlug: z.string().min(1),
  categorySlug: z.string().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(48, "Page size is capped at 48").default(12),
});

export type ProductListInput = z.infer<typeof productListInputSchema>;

export const productFeaturedInputSchema = z.object({
  tenantSlug: z.string().min(1),
  limit: z.number().int().min(1).max(24).default(6),
});

export const productDetailInputSchema = z.object({
  tenantSlug: z.string().min(1),
  productSlug: z.string().min(1),
});

export const productGetForAdminInputSchema = z.object({
  tenantSlug: z.string().min(1),
  productId: z.string().uuid("Invalid product id"),
});

/* ──────────────────────────────────────────────────────────────────────────
 * THE FORM'S OWN SCHEMA
 *
 * Distinct from the router's inputs on purpose: the form holds a price STRING
 * and a comma-separated ingredient STRING, and it needs a blank slug to be
 * VALID ("leave blank to generate one"). The conversion to `priceCents` and an
 * `activeIngredients` array happens in the component's `onSubmit`.
 * ──────────────────────────────────────────────────────────────────────── */

export const productFormSchema = z.object({
  name: nameSchema,
  slug: z
    .string()
    .trim()
    .max(SLUG_MAX, `Keep the slug under ${SLUG_MAX} characters`)
    .refine(
      (value) => value === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
      "Use lowercase letters, numbers and single hyphens",
    ),
  summary: summarySchema,
  description: descriptionSchema,
  price: z
    .string()
    .trim()
    .min(1, "Enter a price")
    .refine((value) => inputToCents(value) !== null, "Enter a valid amount, like 48.50")
    .refine(
      (value) => (inputToCents(value) ?? Infinity) <= PRICE_CENTS_MAX,
      `Price cannot exceed ${PRICE_CENTS_MAX / 100}`,
    ),
  /** `""` means "no category"; becomes null at the submit boundary. */
  categoryId: z.string(),
  /** Same rule as the router's `imagePathSchema`, via the shared predicate. */
  imageUrl: z
    .string()
    .trim()
    .max(IMAGE_ADDRESS_MAX, `Keep the image address under ${IMAGE_ADDRESS_MAX} characters`)
    .refine(
      isAllowedImageUrl,
      "Use a path inside your public folder (/products/monitor.png) or a direct https:// image URL (like your R2 bucket).",
    ),
  isActive: z.boolean(),
  packSize: z
    .string()
    .trim()
    .min(1, "Set a pack size")
    .max(PACK_SIZE_MAX, `Keep the pack size under ${PACK_SIZE_MAX} characters`),
  activeIngredients: z
    .string()
    .trim()
    .max(INGREDIENT_MAX * INGREDIENTS_MAX_COUNT, "Too many characters for ingredients")
    .refine(
      (value) =>
        value === "" ||
        value.split(",").filter((part) => part.trim() !== "").length <= INGREDIENTS_MAX_COUNT,
      `At most ${INGREDIENTS_MAX_COUNT} ingredients`,
    ),
  generic: z.boolean(),
  requiresPrescription: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;