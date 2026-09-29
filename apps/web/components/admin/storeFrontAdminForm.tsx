"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { trpc } from "@/utils/trpc";
import {
  heroSchema,
  sectionsFormSchema,
  themeSchema,
  type StorefrontHeroValues,
  type StorefrontSectionsValues,
  type StorefrontThemeValues,
} from "@/lib/storefront-schema";
import type { StorefrontConfigView } from "@/lib/storefront-types";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ONE FILE. THREE FORMS. ONE PROCEDURE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This replaces `components/admin/form.tsx` AND `components/admin/storefront-editor.tsx`,
 * both deleted.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT WAS ACTUALLY WRONG WITH THE OLD SHAPE
 *
 * The previous code spread one page's concerns across four layers:
 *
 *   form.tsx  <AdminForm>  →  render-prop <Field>  →  <Field>-wrapping <ColorField>
 *   storefront-editor.tsx  →  its own FormData parsing on submit
 *
 * Two concrete problems, not just taste:
 *
 * 1. TO ANSWER "WHAT HAPPENS ON SUBMIT" YOU READ THREE FILES. No field name
 *    appeared in exactly one place, so a rename could not be compiler-checked.
 *
 * 2. THE SUBMIT PATH WAS UNTYPED AND POSITIONAL. The editor called
 *    `formData.get("primaryColor")` and cast it to a string. A typo in that
 *    literal — `primaryColour` — is not a compile error. It is an empty
 *    string, which fails the hex regex with a message pointing at a field the
 *    owner can see, while the real cause sits invisibly in the diff.
 *
 * `react-hook-form` removes the second problem structurally: `register("headline")`
 * and the `onSubmit(values)` payload are both checked against the same inferred
 * type. Rename the field and `pnpm typecheck` fails.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE STRUCTURE NOW
 *
 *   HeroConfigForm      owns hero.*            → one submit → storefront.update
 *   ThemeConfigForm     owns theme.*           → one submit → storefront.update
 *   SectionsConfigForm  owns the two booleans  → one submit → storefront.update
 *
 * Each is independently valid and independently savable. That is the
 * single-responsibility part: a colour can be wrong while the copy is right,
 * and the owner should not have to resubmit their headline to fix it.
 */

/* ────────────────────────────────────────────────────────────────────────────
   1. THE SHARED MUTATION — one hook, used by all three forms
   ──────────────────────────────────────────────────────────────────────── */

/**
 * `config` is a single jsonb column, so writing it REPLACES the whole blob.
 * Every form must therefore send the COMPLETE config with only its own section
 * replaced. Each form receives the whole config as a prop and spreads it, which
 * is why no form can accidentally null out a sibling's section.
 *
 * A shared hook rather than three copies, because the cache handling below is
 * the subtle part and must not drift between forms.
 */
function useUpdateStorefront(
  tenantSlug: string,
  onSaved: (config: StorefrontConfigView) => void,
) {
  const router = useRouter();
  const utils = trpc.useUtils();

  return trpc.storefront.update.useMutation({
    onSuccess: (data) => {
      /**
       * TWO SEPARATE CACHES. This is the part that bites everyone once.
       *
       * React Query holds what a CLIENT component fetched. The Next.js ROUTER
       * cache holds the RENDERED OUTPUT of your server components. The brand
       * colour is applied by `[tenantSlug]/layout.tsx` as a `--tenant-primary`
       * custom property on server-rendered markup — that output is not in
       * React Query at all.
       *
       * Both steps are required:
       *   1. `setData`          → client components reading these queries are correct now
       *   2. `router.refresh()` → the server re-renders and the public page repaints
       *
       * Skip step 2 and the owner saves successfully, sees "Saved", and the
       * public page keeps the old colour with no error anywhere. This is the
       * most common "it didn't work" report in this stack.
       */
      utils.tenant.getBySlug.setData({ tenantSlug }, (prev) =>
        prev ? { ...prev, config: data } : prev,
      );
      utils.storefront.get.setData({ tenantSlug }, data);

      onSaved(data);
      router.refresh();
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   2. INPUT STYLES
   ──────────────────────────────────────────────────────────────────────── */

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-[14px] " +
  "text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 " +
  "aria-invalid:border-destructive";

/* ────────────────────────────────────────────────────────────────────────────
   3. THE CARD — and it IS the <form>
   ──────────────────────────────────────────────────────────────────────── */

/**
 * The card and the `<form>` are the SAME element, and that is deliberate.
 *
 * A `<button type="submit">` only submits the `<form>` it is a DESCENDANT of.
 * An earlier version of this file put the `<form>` around the fields and the
 * button in a `<footer>` outside it — so the primary action of the whole page
 * silently did nothing, and nothing in the UI indicated why.
 *
 * If you ever need a submit control outside the card, the fix is
 * `form="card-id"` on the button, never moving the button out of the form.
 *
 * This component knows nothing about tRPC or about which form it wraps; it is
 * handed the already-bound submit handler and the pending flag.
 */
function FormCard({
  title,
  description,
  onSubmit,
  submitLabel,
  pending,
  error,
  children,
}: {
  title: string;
  description?: string;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl border border-border/60 bg-white overflow-hidden"
    >
      <header className="px-6 pt-6 pb-5 border-b border-border/60">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </header>

      <div className="px-6 py-6 flex flex-col gap-6">
        {/*
          `role="alert"` so a rejection is ANNOUNCED, not merely drawn. An error
          that appears silently is a WCAG 3.3.1 failure: the owner pressed save
          and nothing visibly happened.

          This shows the SERVER's message. For a Zod failure that names the
          offending field, which beats a generic "something went wrong".
        */}
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-[13px] text-destructive"
          >
            {error}
          </p>
        ) : null}

        {children}
      </div>

      <footer className="px-6 py-5 border-t border-border/60 flex justify-end">
        {/*
          `disabled` is the point. Without it a double-click on a slow
          connection fires two mutations — two writes, two `updatedAt` stamps,
          and a confusing "which one saved?" moment.
        */}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex items-center justify-center rounded-full px-5 py-2.5
                     text-[14px] font-semibold text-white shadow-sm transition-all
                     hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
          style={{ backgroundColor: "var(--tenant-primary, #B91C1C)" }}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </footer>
    </form>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   4. FIELD — label, hint and error, correctly associated
   ──────────────────────────────────────────────────────────────────────── */

/**
 * `useId` rather than a hardcoded `id="headline"`, because a hardcoded id is
 * duplicated the moment two of the same control render on one page, and
 * `htmlFor` would then point the label at the wrong input.
 *
 * `aria-describedby` lists the HINT before the ERROR, so a screen reader reads
 * the guidance first and the problem second. Listing only the error would drop
 * the hint exactly when it is most useful.
 */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-foreground">
        {label}
      </label>

      {children({
        id,
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

/**
 * A checkbox with a CSS-only visual.
 *
 * `register()` on a checkbox writes a real BOOLEAN. The old FormData approach
 * produced the STRING `"on"`, which is why a toggle was a recurring source of
 * silent type bugs that only surfaced as a schema error on the server.
 */
function Toggle({
  label,
  hint,
  error,
  registration,
}: {
  label: string;
  hint?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex items-start gap-3">
      {/*
        The input, the track and the knob are SIBLINGS inside one `<label>`, and
        that structure is load-bearing.

        Tailwind's `peer-checked:` compiles to the general sibling combinator
        (`~`), which reaches SIBLINGS of the `peer` and not descendants. Nest the
        knob inside the track and the switch renders permanently off while the
        checkbox underneath is genuinely checked — a real bug that looks like a
        styling nit.
      */}
      <label className="relative shrink-0 w-10 h-6 cursor-pointer">
        <input
          {...registration}
          type="checkbox"
          id={id}
          className="peer sr-only"
          aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        />

        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-muted border border-border
                     transition-colors peer-checked:bg-[var(--tenant-primary)]
                     peer-checked:border-transparent
                     peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/30"
        />

        <span
          aria-hidden="true"
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm
                     transition-transform peer-checked:translate-x-4"
        />
      </label>

      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground cursor-pointer">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-[12px] text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORM 1 — HERO
   ══════════════════════════════════════════════════════════════════════════ */

export function HeroConfigForm({
  tenantSlug,
  config,
  onSaved,
}: {
  tenantSlug: string;
  config: StorefrontConfigView;
  onSaved: (config: StorefrontConfigView) => void;
}) {
  const update = useUpdateStorefront(tenantSlug, onSaved);

  const form = useForm<StorefrontHeroValues>({
    resolver: zodResolver(heroSchema),
    defaultValues: config.hero,
  });

  /**
   * `values` is typed as `StorefrontHeroValues`, so the compiler guarantees
   * those four keys exist and are strings. The spread replaces ONLY `hero`,
   * which is what stops a headline save from wiping the brand colour.
   */
  function onSubmit(values: StorefrontHeroValues) {
    update.mutate({ tenantSlug, config: { ...config, hero: values } });
  }

  const { register, handleSubmit, formState } = form;
  const { errors, isSubmitting } = formState;
  // See CategoryAdminForm for why isSubmitting alone re-enables the button
  // before the request has actually finished.
  const pending = isSubmitting || update.isPending;

  return (
    <FormCard
      title="Hero"
      description="The first thing a visitor sees when they land on your storefront."
      submitLabel="Save hero"
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      error={update.error?.message}
    >
      <Field label="Headline" error={errors.headline?.message}>
        {(a11y) => (
          <input
            {...register("headline")}
            {...a11y}
            className={inputClass}
            maxLength={90}
            placeholder="Clinical care, quietly delivered."
          />
        )}
      </Field>

      <Field label="Subheadline" error={errors.subheadline?.message}>
        {(a11y) => (
          <input
            {...register("subheadline")}
            {...a11y}
            className={inputClass}
            maxLength={160}
          />
        )}
      </Field>

      <Field label="Button label" error={errors.ctaLabel?.message}>
        {(a11y) => (
          <input
            {...register("ctaLabel")}
            {...a11y}
            className={inputClass}
            maxLength={30}
          />
        )}
      </Field>

      <Field
        label="Button link"
        hint={
          <>
            A path inside your storefront, like{" "}
            <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">/shop</code>.
            External addresses are rejected so the link cannot send visitors off your site.
          </>
        }
        error={errors.ctaHref?.message}
      >
        {(a11y) => (
          <input
            {...register("ctaHref")}
            {...a11y}
            className={`${inputClass} font-mono`}
            placeholder="/shop"
          />
        )}
      </Field>
    </FormCard>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORM 2 — THEME
   ══════════════════════════════════════════════════════════════════════════ */

export function ThemeConfigForm({
  tenantSlug,
  config,
  onSaved,
}: {
  tenantSlug: string;
  config: StorefrontConfigView;
  onSaved: (config: StorefrontConfigView) => void;
}) {
  const update = useUpdateStorefront(tenantSlug, onSaved);

  const form = useForm<StorefrontThemeValues>({
    resolver: zodResolver(themeSchema),
    defaultValues: config.theme,
  });

  function onSubmit(values: StorefrontThemeValues) {
    update.mutate({ tenantSlug, config: { ...config, theme: values } });
  }

  const { register, handleSubmit, setValue, control, formState } = form;
  const { errors, isSubmitting } = formState;
  // See CategoryAdminForm for why isSubmitting alone re-enables the button
  // before the request has actually finished.
  const pending = isSubmitting || update.isPending;

  /**
   * THE COLOUR FIELD.
   *
   * The picker and the text box are two controls for ONE value, and a
   * subscription keeps them in sync as the owner types or picks.
   *
   * The TEXT FIELD is what gets submitted; the picker is a convenience. If they
   * ever disagreed, the text field wins — because `setValue` writes the same key
   * that `register("primaryColor")` submits.
   *
   * Note this is possible now and was not before: the old `ColorField` was a
   * Server Component, and React refuses to pass an event handler across that
   * boundary. Everything in this file is `"use client"`, so `onChange` is legal.
   *
   * `useWatch`, NOT `watch`. Both subscribe to the same value, but `watch()`
   * comes off the `useForm()` result, and the React Compiler refuses to
   * memoise around it (`react-hooks/incompatible-library`) because the
   * subscription cannot be proven free of stale reads. `useWatch` is the
   * standalone subscription the library provides for exactly this case.
   */
  const primaryColor = useWatch({ control, name: "primaryColor" });

  function setColor(next: string) {
    setValue("primaryColor", next, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <FormCard
      title="Theme"
      description="The colour and typography applied across your public storefront."
      submitLabel="Save theme"
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      error={update.error?.message}
    >
      <Field
        label="Brand colour"
        hint="Drives your buttons, badges and the announcement bar."
        error={errors.primaryColor?.message}
      >
        {(a11y) => (
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="w-11 h-11 shrink-0 rounded-lg border border-border shadow-inner"
              style={{ backgroundColor: primaryColor }}
            />

            <input
              type="color"
              aria-label="Pick brand colour"
              value={primaryColor}
              onChange={(e) => setColor(e.target.value)}
              className="w-11 h-11 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-0"
            />

            <input
              {...register("primaryColor")}
              {...a11y}
              onChange={(e) => setColor(e.target.value)}
              className={`${inputClass} max-w-[140px] font-mono uppercase`}
              placeholder="#B91C1C"
              maxLength={7}
            />
          </div>
        )}
      </Field>

      <Toggle
        label="Show trust badges"
        hint="Displays the clinician-reviewed and discreet-delivery claims. Only turn these on if they are true for your clinic."
        error={errors.showTrustBadges?.message}
        registration={register("showTrustBadges")}
      />
    </FormCard>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORM 3 — SECTIONS
   ══════════════════════════════════════════════════════════════════════════ */

export function SectionsConfigForm({
  tenantSlug,
  config,
  onSaved,
}: {
  tenantSlug: string;
  config: StorefrontConfigView;
  onSaved: (config: StorefrontConfigView) => void;
}) {
  const update = useUpdateStorefront(tenantSlug, onSaved);

  const form = useForm<StorefrontSectionsValues>({
    resolver: zodResolver(sectionsFormSchema),
    defaultValues: {
      showCategories: config.showCategories,
      announcementEnabled: Boolean(config.announcement),
      announcement: config.announcement ?? "",
    },
  });

  /**
   * THE NULLABLE TRANSLATION, IN ONE PLACE.
   *
   * The column is `string | null`; the form works in plain strings plus an
   * explicit on/off toggle. Storing `""` instead of `null` would render an
   * announcement bar with nothing in it, so the conversion is made explicit
   * here rather than implied by the control.
   */
  function onSubmit(values: StorefrontSectionsValues) {
    update.mutate({
      tenantSlug,
      config: {
        ...config,
        showCategories: values.showCategories,
        announcement:
          values.announcementEnabled && values.announcement !== ""
            ? values.announcement
            : null,
      },
    });
  }

  const { register, handleSubmit, control, formState } = form;
  const { errors, isSubmitting } = formState;
  // See CategoryAdminForm for why isSubmitting alone re-enables the button
  // before the request has actually finished.
  const pending = isSubmitting || update.isPending;

  /**
   * A SUBSCRIPTION, so this re-renders the form whenever the toggle changes and
   * the announcement field appears or disappears. `useWatch` rather than
   * `watch` for the reason given in `ThemeConfigForm`: the React Compiler
   * cannot memoise around `watch()`.
   *
   * This is the right tool at four fields. On a 50-field form the render cost
   * would matter and `useFieldArray` or a narrower subscription would be
   * preferable.
   */
  const announcementEnabled = useWatch({ control, name: "announcementEnabled" });

  return (
    <FormCard
      title="Sections"
      description="Choose which parts of your storefront are visible."
      submitLabel="Save sections"
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      error={update.error?.message}
    >
      <Toggle
        label="Show category navigation"
        hint="Displays the 'Shop by category' strip on your home page."
        error={errors.showCategories?.message}
        registration={register("showCategories")}
      />

      <Toggle
        label="Show an announcement bar"
        hint="A single line across the top of every page."
        error={errors.announcementEnabled?.message}
        registration={register("announcementEnabled")}
      />

      {announcementEnabled ? (
        <Field
          label="Announcement text"
          hint="Leave blank to hide the bar."
          error={errors.announcement?.message}
        >
          {(a11y) => (
            <input
              {...register("announcement")}
              {...a11y}
              className={inputClass}
              placeholder="Free first consultation for eligible patients."
              maxLength={200}
            />
          )}
        </Field>
      ) : null}
    </FormCard>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   THE PAGE BODY
   ══════════════════════════════════════════════════════════════════════════ */

export function StorefrontAdminForm({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: StorefrontConfigView;
}) {
  /**
   * The SERVER's answer is the single source of truth for all three forms.
   *
   * After a save, `onSaved` replaces this state and every form re-seeds from
   * it. `useForm`'s `defaultValues` are read ONCE on mount, so without this
   * re-seed the owner would see "Saved" above an input still showing the old
   * hex — a success message contradicting the form.
   *
   * Remounting via a changing `key` is the cheap way to force RHF to re-read
   * `defaultValues`. It is correct HERE because these forms hold no other local
   * state: the only thing on the form is the value being replaced anyway. A
   * form mid-edit (a draft, a dirty-check prompt) must use `form.reset()` on
   * the saved values instead — a remount would silently discard that work.
   */
  const [config, setConfig] = useState<StorefrontConfigView>(initial);

  function onSaved(next: StorefrontConfigView) {
    setConfig(next);
  }

  const { headline, ctaHref } = config.hero;
  const { primaryColor, fontFamily, showTrustBadges } = config.theme;
  const { showCategories, announcement } = config;

  return (
    <div className="max-w-[720px] flex flex-col gap-6">
      <HeroConfigForm
        key={`hero-${headline}-${ctaHref}`}
        tenantSlug={tenantSlug}
        config={config}
        onSaved={onSaved}
      />

      <ThemeConfigForm
        key={`theme-${primaryColor}-${fontFamily}-${String(showTrustBadges)}`}
        tenantSlug={tenantSlug}
        config={config}
        onSaved={onSaved}
      />

      <SectionsConfigForm
        key={`sections-${String(showCategories)}-${announcement ?? ""}`}
        tenantSlug={tenantSlug}
        config={config}
        onSaved={onSaved}
      />
    </div>
  );
}
