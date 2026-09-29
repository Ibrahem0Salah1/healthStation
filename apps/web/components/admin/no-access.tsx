import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function NoAccess() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--tenant-primary)" }}
        >
          <ShieldAlert className="h-6 w-6 text-white" />
        </div>

        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          You don&apos;t have access to this clinic
        </h1>

        <p className="mt-3 text-[15px] text-muted-foreground">
          You&apos;re signed in, but this account isn&apos;t a member of the
          clinic you&apos;re trying to open. If that&apos;s wrong, ask the
          clinic owner to invite you.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-input px-5 text-[14px] font-semibold"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}