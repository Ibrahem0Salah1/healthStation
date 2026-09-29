import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@/server/root";

/**
 * Type-only import. This is the payoff of the monorepo: `AppRouter` is
 * derived from the actual server implementation, so there is no hand-written
 * client type to drift out of sync. Rename a procedure and this file breaks
 * at compile time.
 *
 * `import type` is erased at build time, so `@/server/root` is NEVER bundled
 * into the browser — importing it for real would drag `db.ts` and your
 * DATABASE_URL with it.
 */
export const trpc = createTRPCReact<AppRouter>();
