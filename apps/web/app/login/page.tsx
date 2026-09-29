import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — healthStation",
  description: "Sign in to manage your clinic storefront.",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Clinic Owner Access"
      title={
        <>
          Welcome
          <br />
          <span className="text-foreground/30">back.</span>
        </>
      }
      subtitle="Manage your products, categories, and storefront configuration from one place."
      pitch={[
        "Add and edit your catalog",
        "Configure hero copy and brand colors",
        "Organize products into categories",
        "Changes are live the moment you save",
      ]}
      footer={
        <>
          Demo logins —{" "}
          <span className="font-mono text-[11px]">cairo@demo.test</span> or{" "}
          <span className="font-mono text-[11px]">alex@demo.test</span> · password{" "}
          <span className="font-mono text-[11px]">Password123!</span>
        </>
      }
    >
      {/*
        Suspense is REQUIRED here, not decorative. `useSearchParams` forces
        the subtree to render on the client for the request, and Next 16
        errors at build time if a `useSearchParams` call has no Suspense
        boundary above it. The fallback reserves roughly the form's height so
        the surrounding layout does not jump when the form hydrates.
      */}
      <Suspense fallback={<div className="h-[380px]" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
