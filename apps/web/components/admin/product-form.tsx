"use client";

import { useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormRegisterReturn } from "react-hook-form";
import type { Product } from "@repo/database";
import { ArrowLeft } from "lucide-react";

import { trpc } from "@/utils/trpc";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/lib/product-schema";
import { centsToInput, inputToCents } from "@/lib/money";
import type { CategoryView } from "@/lib/storefront-types";

/**
 * THE PRODUCT FORM — shared by `/admin/products/new` and
 * `/admin/products/[productId]`.
 *
 * Ported to `react-hook-form` now that Brick 5 supplies the mutations this
 * form was waiting for. All the review notes from the Server Component version
 * still apply; what changed is that the form finally submits to something.
 *
 * ── THE MUTATIONS ──────────────────────────────────────────────────────
 * Create and update are TWO separate `useMutation` calls, not one chosen
 * conditionally at render time. `isEdit` is constant for a mounted form
 * (the route is either `/new` or `/[productId]`, never both), but keeping
 * both hooks declared top-level means there is no conditional-hook shape at
 * all — React's Rules-of-Hooks lint cannot trip over an `isEdit ? A : B`.
 *
 *   create.mutate({ ...base, isActive })      // server adds sortOrder
 *   update.mutate({ ...base, productId })     // scoped to ctx.tenant.id
 *
 * Both take `tenantSlug` and NEVER `tenantId` — the router derives the id
 * from `ctx.tenant.id`, which came from the slug in the URL. A form that
 * never has a `tenantId` key cannot send one, which is the point.
 *
 * ── WHAT HAPPENS AT THE SUBMIT BOUNDARY ────────────────────────────────
 * The form works in the owner's units; the server speaks the platform's:
 *
 *   "48.50"        → priceCents 4850      (inputToCents, lib/money.ts)
 *   ""  (category) → categoryId null
 *   "CoQ10, B12"   → activeIngredients ["CoQ10", "B12"]
 *   ""  (image)    → imageUrl null
 *
 * This is where string inputs become the honest shapes the server schemas
 * declare — the browser-side half of a join the router enforces with
 * `.strict()`.
 */

type EditProduct = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  categoryId: string | null;
  isActive: boolean;
  details: Product["details"];
};

export function ProductForm({
  tenantSlug,
  categories,
  product,
}: {
  tenantSlug: string;
  categories: CategoryView[];
  /** Absent for the "new product" route; present for the edit route. */
  product?: EditProduct;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const isEdit = Boolean(product);
  const submitLabel = isEdit ? "Save changes" : "Create product";

  const invalidateAll = () => {
    /*
     * ONE toggle or save touches THREE views: the admin table, the public
     * shop grid and the home strip (and, for a slug change, the cached
     * product page). Invalidating only the first leaves a storefront that
     * shows a product the owner just renamed or hid, until a hard refresh.
     * All three run inside `onSuccess` because they must run TOGETHER on the
     * new server state.
     */
    utils.product.listForAdmin.invalidate({ tenantSlug });
    utils.product.list.invalidate({ tenantSlug });
    utils.product.featured.invalidate({ tenantSlug });
    router.push(`/${tenantSlug}/admin/products`);
  };

  const create = trpc.product.create.useMutation({ onSuccess: invalidateAll });
  const update = trpc.product.update.useMutation({ onSuccess: invalidateAll });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      summary: product?.summary ?? "",
      description: product?.description ?? "",
      price: product ? centsToInput(product.priceCents) : "",
      categoryId: product?.categoryId ?? "",
      imageUrl: product?.imageUrl ?? "",
      isActive: product?.isActive ?? true,
      packSize: product?.details.packSize ?? "",
      activeIngredients: (product?.details.activeIngredients ?? []).join(", "),
      generic: product?.details.generic ?? true,
      requiresPrescription: product?.details.requiresPrescription ?? false,
    },
  });

  const { register, handleSubmit, formState } = form;
  const { errors, isSubmitting } = formState;

  const pending = isSubmitting || create.isPending || update.isPending;
  const mutationError = create.error ?? update.error;

  function onSubmit(values: ProductFormValues) {
    const priceCents = inputToCents(values.price);
    /* Unreachable: the schema's `price` refine already rejected it. */
    if (priceCents === null) return;

    const base = {
      tenantSlug,
      name: values.name,
      /* A blank slug is meaningful: it tells the server to derive one. */
      slug: values.slug,
      summary: values.summary,
      description: values.description,
      priceCents,
      categoryId: values.categoryId === "" ? null : values.categoryId,
      imageUrl: values.imageUrl,
      details: {
        packSize: values.packSize,
        activeIngredients: parseIngredients(values.activeIngredients),
        generic: values.generic,
        requiresPrescription: values.requiresPrescription,
      },
    };

    if (isEdit && product) {
      update.mutate({ ...base, productId: product.id, isActive: values.isActive });
    } else {
      create.mutate({ ...base, isActive: values.isActive });
    }
  }

  const base = `/${tenantSlug}/admin`;

  return (
    <>
      <Link
        href={`${base}/products`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to products
      </Link>

      {mutationError ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-[13px] text-destructive max-w-[760px]"
        >
          {/*
            `mutation.error.message` is a TRPCClientError message — safe to
            render, and it is the SERVER's validation, which is the only
            validation that counts. Someone can always bypass the browser.
          */}
          {mutationError.message}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="max-w-[760px] flex flex-col gap-6"
      >
        <Card
          title={isEdit ? "Edit product" : "New product"}
          description={
            isEdit
              ? "Changes appear on your storefront immediately."
              : "This product will appear on your storefront as soon as it is saved."
          }
        >
          <Field
            id="product-name"
            label="Product name"
            hint="Shown as the product heading on the storefront and in search results."
            error={errors.name?.message}
          >
            {(a11y) => (
              <input
                {...register("name")}
                {...a11y}
                type="text"
                className={inputClass}
              />
            )}
          </Field>

          <Field
            id="product-slug"
            label="URL slug"
            hint={
              <>
                The product will live at{" "}
                <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  /{tenantSlug}/product/{product?.slug ?? "your-product"}
                </code>
                . Leave blank to generate one from the name. Use lowercase
                letters, numbers and hyphens.
              </>
            }
            error={errors.slug?.message}
          >
            {(a11y) => (
              <input
                {...register("slug")}
                {...a11y}
                type="text"
                placeholder="blood-pressure-monitor"
                className={`${inputClass} font-mono`}
              />
            )}
          </Field>

          <Field
            id="product-summary"
            label="Short summary"
            error={errors.summary?.message}
          >
            {(a11y) => (
              <textarea
                {...register("summary")}
                {...a11y}
                rows={3}
                className={`${inputClass} min-h-[80px] resize-y`}
              />
            )}
          </Field>

          <Field
            id="product-description"
            label="Full description"
            hint="Shown on the product page. Line breaks are preserved."
            error={errors.description?.message}
          >
            {(a11y) => (
              <textarea
                {...register("description")}
                {...a11y}
                rows={6}
                className={`${inputClass} min-h-[140px] resize-y`}
              />
            )}
          </Field>
        </Card>

        <Card title="Pricing and visibility">
          <Field
            id="product-price"
            label="Price"
            hint={
              <>
                Enter an amount in your store currency. Stored as an integer
                — 48.50 becomes 4850 cents — and the integer is what crosses
                the wire.
              </>
            }
            error={errors.price?.message}
          >
            {(a11y) => (
              <input
                {...register("price")}
                {...a11y}
                type="text"
                inputMode="decimal"
                placeholder="48.50"
                className={inputClass}
              />
            )}
          </Field>

          <Field
            id="product-category"
            label="Category"
            hint="Optional. Uncategorised products still appear in your shop, just not under a category."
          >
            {(a11y) => (
              <select
                {...register("categoryId")}
                {...a11y}
                className={inputClass}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="product-image"
            label="Image path"
            hint={
              <>
                A path from your public folder, like{" "}
                <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  /products/monitor.png
                </code>
                . A full URL is not accepted — a tenant could otherwise use the
                image field to track your visitors.
              </>
            }
            error={errors.imageUrl?.message}
          >
            {(a11y) => (
              <input
                {...register("imageUrl")}
                {...a11y}
                type="text"
                placeholder="/products/monitor.png"
                className={`${inputClass} font-mono`}
              />
            )}
          </Field>

          <Checkbox
            registration={register("isActive")}
            label="Visible on storefront"
            hint="Turn this off to hide the product without deleting it."
          />
        </Card>

        {/*
          `ProductDetails` is a FIXED platform shape (`FEATURES.md` §5.2) — a
          supplement with no pack size is not sellable, so these fields are not
          the tenant's to define. They sit in their own card so it is visually
          obvious they are structured data rather than free copy.
        */}
        <Card
          title="Product details"
          description="Structured fields used for filtering and for the specification table."
        >
          <Field
            id="product-pack-size"
            label="Pack size"
            error={errors.packSize?.message}
          >
            {(a11y) => (
              <input
                {...register("packSize")}
                {...a11y}
                type="text"
                placeholder="60 capsules"
                className={inputClass}
              />
            )}
          </Field>

          <Field
            id="product-ingredients"
            label="Active ingredients"
            hint="Comma separated. Leave blank for products with no ingredients, such as a monitor."
            error={errors.activeIngredients?.message}
          >
            {(a11y) => (
              <input
                {...register("activeIngredients")}
                {...a11y}
                type="text"
                placeholder="Coenzyme Q10, Vitamin B12"
                className={inputClass}
              />
            )}
          </Field>

          <Checkbox
            registration={register("generic")}
            label="Generic product"
            hint="Not a brand name. Generic items do not require a brand-specific prescription."
          />

          <Checkbox
            registration={register("requiresPrescription")}
            label="Requires a prescription"
            hint="Shows a prescription notice on the product page."
          />
        </Card>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            style={{ backgroundColor: "var(--tenant-primary, #B91C1C)" }}
          >
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </>
  );
}

/** "CoQ10,  B12 ," → ["CoQ10", "B12"]. Blank-safe: a monitor has no actives. */
function parseIngredients(raw: string): string[] {
  return raw
    .split(",")
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

/* ────────────────────────────────────────────────────────────────────────────
   LOCAL PRESENTATION — private to this file
   ──────────────────────────────────────────────────────────────────────────── */

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-[14px] " +
  "text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 " +
  "aria-invalid:border-destructive";

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-white overflow-hidden">
      <header className="px-6 pt-6 pb-5 border-b border-border/60">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="px-6 py-6 flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => React.ReactNode;
}) {
  const safeId = useId();
  const inputId = `${safeId}-${id}`;
  const hintId = `${safeId}-hint`;
  const errorId = `${safeId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[13px] font-medium text-foreground">
        {label}
      </label>

      {children({
        id: inputId,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}

      {hint ? (
        <p id={hintId} className="text-[12px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Checkbox({
  registration,
  label,
  hint,
}: {
  registration: UseFormRegisterReturn;
  label: string;
  hint: string;
}) {
  const id = useId();

  return (
    <div className="flex items-start gap-3">
      <input
        {...registration}
        id={id}
        type="checkbox"
        className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--tenant-primary,#B91C1C)]"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground cursor-pointer">
          {label}
        </label>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}