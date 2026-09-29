"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { trpc } from "@/utils/trpc";
import { categoryFormSchema, type CategoryFormValues } from "@/lib/category-schema";

export function CategoryAdminForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", slug: "" },
  });

  const { register, handleSubmit, formState } = form;
  const { errors, isSubmitting } = formState;

  const [savedName, setSavedName] = useState<string | null>(null);

  const create = trpc.category.create.useMutation({
    onSuccess: (data) => {
      utils.category.listForAdmin.invalidate({ tenantSlug });
      utils.category.list.invalidate({ tenantSlug });

      setSavedName(data.name);
      form.reset();
      router.refresh();
    },
  });

  const pending = isSubmitting || create.isPending;

  function onSubmit(values: CategoryFormValues) {
    // Clear the previous confirmation the moment a new attempt starts.
    setSavedName(null);
    create.mutate({
      tenantSlug,
      name: values.name,
      // A blank slug is meaningful: it tells the server to derive one.
      slug: values.slug,
    });
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-white overflow-hidden">
      <header className="px-5 pt-5 pb-4 border-b border-border/60">
        <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
          New category
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Appears in your shop navigation straight away.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-5 py-5 flex flex-col gap-5">
        {create.error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-[13px] text-destructive"
          >
            {create.error.message}
          </p>
        ) : null}

        {savedName ? (
          <p
            role="status"
            className="rounded-xl border border-emerald-600/20 bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-800"
          >
            Created <span className="font-medium">{savedName}</span>.
          </p>
        ) : null}

        <Field
          label="Category name"
          hint="Shown in your shop navigation and on every product in this category."
          error={errors.name?.message}
        >
          {(a11y) => (
            <input
              {...register("name")}
              {...a11y}
              type="text"
              placeholder="Heart Health"
              className={inputClass}
            />
          )}
        </Field>

        <Field
          label="URL slug"
          hint={
            <>
              Leave blank to generate one from the name. Must be unique within this clinic, not
              globally — two clinics can both have &quot;Pain Relief&quot;.
            </>
          }
          error={errors.slug?.message}
        >
          {(a11y) => (
            <input
              {...register("slug")}
              {...a11y}
              type="text"
              placeholder="heart-health"
              className={`${inputClass} font-mono`}
            />
          )}
        </Field>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5
                       text-[14px] font-semibold text-white shadow-sm transition-all
                       hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            style={{ backgroundColor: "var(--tenant-primary, #B91C1C)" }}
          >
            {pending ? "Creating…" : "Create category"}
          </button>
        </div>
      </form>
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-[14px] " +
  "text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 " +
  "aria-invalid:border-destructive";
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
