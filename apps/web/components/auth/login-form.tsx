"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Field, FormError, SubmitButton, inputClass } from "./field";

export function LoginForm() {
  const router = useRouter();

  /**
   * `useSearchParams` marks this subtree as DYNAMIC — it opts out of static
   * rendering. That is the cost of reading `?next=` in the browser, and it is
   * paid only by /login, not by the landing page or any storefront.
   *
   * The `?next=` value is attacker-controllable, so it is validated below
   * before being used as a redirect target. An unchecked `router.push(next)`
   * here is an open redirect: `?next=https://evil.test` sends a freshly
   * authenticated user to an attacker page that looks like a login
   * confirmation. Never navigate to a value from the query string without
   * this check.
   */
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (payload?.errors?.fieldErrors) {
          setFieldErrors(payload.errors.fieldErrors);
        }
        setFormError(payload?.message ?? "Could not sign in.");
        setPending(false);
        return;
      }

      const tenants = payload.data.tenants ?? [];

      if (tenants.length === 0) {
        /**
         * A valid user with no membership. `FEATURES.md` makes this state
         * unreachable — signup creates user + tenant + membership atomically,
         * so there is no code path that produces it. Handling it anyway is
         * cheap, and a redirect into `/undefined/admin` would be a confusing
         * dead end.
         */
        setFormError(
          "Your account is not connected to a clinic yet. Please contact support.",
        );
        setPending(false);
        return;
      }

      /**
       * `next` wins, but only if it is an INTERNAL absolute path. The
       * leading slash plus the absence of `//` is what rejects
       * `//evil.test` and `https://evil.test` — both of which are
       * "absolute" to a browser and would leave our origin.
       */
      const safeNext =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : null;

      router.push(safeNext ?? `/${tenants[0].slug}/admin`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          Welcome back
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Sign in to manage your clinic storefront.
        </p>
      </div>

      <FormError message={formError} />

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
        error={fieldErrors.password?.[0]}
      >
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>

      <SubmitButton pending={pending}>
        Log in
        <ArrowRight className="w-4 h-4" />
      </SubmitButton>

      <p className="text-[12px] text-muted-foreground text-center">
        Don&apos;t have a clinic yet?{" "}
        <Link
          href="/signup"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
