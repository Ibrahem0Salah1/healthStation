"use client";

/**
 * The form primitives, shared by LoginForm and SignupForm.
 *
 * Same reasoning as AuthShell: the two forms must not drift apart
 * visually, and the field styling is the thing most likely to drift.
 *
 * The input class is written by hand rather than reusing `components/ui/input`
 * because shadcn's `h-8` is sized for a dense dashboard table. The landing
 * page is a 14–68px marketing layout; an 32px-tall field in it looks broken.
 * Same tokens (`--color-input`, `--color-ring`), different density.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-foreground flex items-baseline justify-between"
      >
        <span>{label}</span>
        {hint ? (
          <span className="text-[11px] font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </label>

      {children}

      {/*
        `role="alert"` makes a screen reader announce the message the moment
        it appears. Without it the text is in the DOM but silent — a
        keyboard or screen-reader user submits a broken form and hears
        nothing.
      */}
      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-input bg-white px-3.5 text-[14px] text-foreground " +
  "placeholder:text-muted-foreground/70 outline-none transition-shadow " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

/**
 * A form-level error banner — the failures that belong to the request rather
 * than to one field (slug already taken, wrong password, network down).
 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-[13px] text-destructive"
    >
      {message}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full h-11 rounded-full bg-foreground text-background px-7 text-[14px] font-semibold shadow-sm hover:bg-foreground/90 transition-all hover:gap-3 disabled:opacity-60 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
    >
      {/*
        A `disabled` button with no feedback reads as a broken page. This
        keeps the label in place and swaps only the words, so the button
        never changes width mid-submit.
      */}
      {pending ? "Just a moment…" : children}
    </button>
  );
}
