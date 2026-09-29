"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Field, FormError, SubmitButton, inputClass } from "./field";

/**
 * WHY A RAW `fetch` AND NOT THE tRPC CLIENT:
 *
 * Signup and login set a `httpOnly` cookie. A cookie set BY the server can
 * only be read by the browser, not by JavaScript — which is the point. The
 * form therefore cannot read the response to decide where to go next; it can
 * only learn "it worked" and navigate. That is a one-shot POST with no
 * response shape worth caching or deduplicating, which is the entire reason
 * tRPC's client would earn its keep.
 *
 * Keeping auth as a route handler is a deliberate split, and it is worth being
 * able to explain: tRPC owns typed *data* access, route handlers own the
 * *credential* exchange. One rule, no ambiguity about which to reach for.
 */
export function SignupForm() {
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [clinicName, setClinicName] = useState("");
  const [slug, setSlug] = useState("");
  /**
   * The slug is derived from the clinic name until the owner edits it by
   * hand. Two states, because the moment a human touches the field the
   * derivation must stop — a form that keeps overwriting what you typed is
   * the single most irritating pattern in onboarding.
   */
  const [slugTouched, setSlugTouched] = useState(false);

  function onClinicNameChange(value: string) {
    setClinicName(value);

    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          // Anything that is not a letter or digit becomes a separator, so
          // "St. Mary's Clinic" → "st-mary-s-clinic".
          .replace(/[^a-z0-9]+/g, "-")
          // Trim leading/trailing hyphens, then collapse runs.
          .replace(/^-+|-+$/g, "")
          .slice(0, 50),
      );
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          tenantName: form.get("tenantName"),
          tenantSlug: form.get("tenantSlug"),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        /**
         * Server-side Zod errors arrive as a FLATTENED map of
         * `field -> [messages]`. Mapping them back onto inputs is the
         * difference between a form that explains itself and one that says
         * "Invalid data" and makes the user guess.
         *
         * Anything that is not field-shaped (a 409 slug collision, a 500)
         * has no `errors` key and falls through to the banner.
         */
        if (payload?.errors?.fieldErrors) {
          setFieldErrors(payload.errors.fieldErrors);
        }

        setFormError(
          payload?.message ?? "Something went wrong. Please try again.",
        );
        setPending(false);
        return;
      }

      /**
       * Straight into the admin of the clinic just created. The server
       * returned the slug it actually assigned — using it rather than the
       * one typed into the form means a normalized or trimmed slug still
       * lands on a valid URL.
       */
      router.push(`/${payload.data.tenant.slug}/admin`);
      router.refresh();
    } catch {
      // A network failure reaches here. `fetch` rejects on a dropped
      // connection; there is no response to read, so the message is generic
      // on purpose — there is no server detail to show and no field to
      // attach it to.
      setFormError("Could not reach the server. Check your connection.");
      setPending(false);
    }
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {/*
        `noValidate` disables the browser's own bubbles. Not laziness: the
        native messages cannot be styled, are not announced consistently by
        screen readers, and appear in a different language than the rest of
        the page. Our own Zod-backed messages replace them entirely.
      */}
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          Create your clinic
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          One form. Your account, your clinic, and its storefront — created
          together.
        </p>
      </div>

      <FormError message={formError} />

      <Field label="Your name" htmlFor="name" error={fieldErrors.name?.[0]}>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Dr. Youssef Nabil"
          className={inputClass}
        />
      </Field>

      <Field
        label="Clinic name"
        htmlFor="tenantName"
        error={fieldErrors.tenantName?.[0]}
      >
        <input
          id="tenantName"
          name="tenantName"
          type="text"
          required
          value={clinicName}
          onChange={(e) => onClinicNameChange(e.target.value)}
          placeholder="Cairo Heart"
          className={inputClass}
        />
      </Field>

      <Field
        label="Clinic URL"
        htmlFor="tenantSlug"
        hint="yourclinic.com"
        error={fieldErrors.tenantSlug?.[0]}
      >
        <div className="flex items-center rounded-xl border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 transition-shadow">
          <span className="pl-3.5 pr-1 text-[14px] text-muted-foreground select-none">
            /
          </span>
          <input
            id="tenantSlug"
            name="tenantSlug"
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="cairo-heart"
            className="h-11 w-full bg-transparent px-1.5 text-[14px] text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
        </div>
      </Field>

      <Field label="Email" htmlFor="email" error={fieldErrors.email?.[0]}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@clinic.com"
          className={inputClass}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="8+ characters"
        error={fieldErrors.password?.[0]}
      >
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>

      <SubmitButton pending={pending}>
        Create clinic &amp; storefront
        <ArrowRight className="w-4 h-4" />
      </SubmitButton>

      <p className="text-[12px] text-muted-foreground text-center">
        Already have a clinic?{" "}
        <Link
          href="/login"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Log in
        </Link>
      </p>

      {hasErrors ? (
        <p className="sr-only" role="status">
          The form has {Object.keys(fieldErrors).length} errors. Please review
          the highlighted fields.
        </p>
      ) : null}
    </form>
  );
}
