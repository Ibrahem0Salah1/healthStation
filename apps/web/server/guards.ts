import { api } from "./caller";
import { TRPCError } from "@trpc/server";
import type { TenantRole } from "@/lib/storefront-types";

export type RoleCheck = { status: "ok"; role: TenantRole }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "not-found" };

export async function checkRole(tenantSlug:string) : Promise<RoleCheck> {
  const caller = await api();
  try {
    const result = await caller.adminCheck({tenantSlug});
    return {status: 'ok', role: result.role}
  } catch (error) {
    if (!(error instanceof TRPCError)) throw error;

    switch (error.code) {
      case "UNAUTHORIZED":
        return { status: "unauthenticated" };
      case "FORBIDDEN":
        return { status: "forbidden" };
      case "NOT_FOUND":
        return { status: "not-found" };
      default:
        throw error;
    }
  }
}
