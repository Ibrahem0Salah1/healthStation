import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your clinic — healthStation",
  description:
    "Launch a branded telehealth storefront in minutes. Your account, clinic, and storefront are created together.",
};

/**
 * A Server Component. The only client JavaScript is SignupForm — the frame,
 * the heading, the feature list and the footer all render to HTML on the
 * server. `useSearchParams` is not used here, so this route can stay static.
 */
export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Self-Serve Provisioning"
      title={
        <>
          Launch a clinic
          <br />
          <span className="text-foreground/30">in one form.</span>
        </>
      }
      subtitle="One transaction creates your account, your clinic, and its storefront. No sales call, no engineering ticket, no waiting."
      pitch={[
        "Your own URL and brand color",
        "Catalog, categories and storefront config",
        "Tenant isolation enforced at three layers",
        "Your clinic's data is yours alone",
      ]}
      footer={
        <>
          Demo clinics:{" "}
          <span className="font-mono text-[11px]">/cairo-heart</span> ·{" "}
          <span className="font-mono text-[11px]">/alexandria-pediatrics</span>{" "}
          — sign in with <span className="font-mono text-[11px]">cairo@demo.test</span>{" "}
          or <span className="font-mono text-[11px]">alex@demo.test</span>
        </>
      }
    >
      <Suspense fallback={<div className="h-[520px]" />}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
