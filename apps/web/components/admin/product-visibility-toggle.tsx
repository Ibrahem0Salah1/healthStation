"use client";

import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { trpc } from "@/utils/trpc";

/**
 * THE VISIBILITY TOGGLE — one column of `product.setActive`, as a button.
 *
 * The admin table is SERVER-RENDERED (the page reads `product.listForAdmin`
 * through `api()`), so the client island's job is narrower than the code
 * comment on the products page once imagined: there is no `useQuery` cache to
 * optimistically patch on this page. `router.refresh()` re-renders the server
 * components with the new `isActive`, and the refetched list is the source of
 * truth. The three `invalidate()` calls are kept because the tRPC query client
 * also caches `list`, `listForAdmin` and `featured` for any OTHER component
 * that hooks them during this session — a missed invalidation there is exactly
 * the stale-storefront bug the original comment warned about.
 */
export function ProductVisibilityToggle({
  tenantSlug,
  productId,
  isActive,
}: {
  tenantSlug: string;
  productId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const toggle = trpc.product.setActive.useMutation({
    onSuccess: () => {
      utils.product.listForAdmin.invalidate({ tenantSlug });
      utils.product.list.invalidate({ tenantSlug });
      utils.product.featured.invalidate({ tenantSlug });
      router.refresh();
    },
  });

  const next = !isActive;

  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ tenantSlug, productId, isActive: next })}
      disabled={toggle.isPending}
      aria-pressed={isActive}
      aria-busy={toggle.isPending}
      title={isActive ? "Hide from storefront" : "Show on storefront"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
        isActive
          ? "bg-green-500/10 text-green-700 hover:bg-green-500/20"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {isActive ? (
        <Eye className="w-3 h-3" aria-hidden="true" />
      ) : (
        <EyeOff className="w-3 h-3" aria-hidden="true" />
      )}
      {isActive ? "Visible" : "Hidden"}
    </button>
  );
}