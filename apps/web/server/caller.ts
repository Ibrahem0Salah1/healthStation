import { cache } from "react";

import { appRouter } from "./root";
import { createTRPCContext } from "./context";

/**
 * Server-side tRPC caller for React Server Components.
 *
 * WHY THIS EXISTS: a Server Component must not fetch its own HTTP endpoint.
 * Doing so would mean the Next server making a network request to itself —
 * resolve the port, wait for itself to boot, serialize to JSON, parse it back.
 * Four round trips and a serializing step to do something that is a function
 * call.
 *
 * `appRouter.createCaller(ctx)` invokes the SAME router, through the SAME
 * middleware chain, with the SAME Zod input validation. It is the identical
 * authorization story minus the network. There is no "trusted" bypass path
 * that skips `hasRole` — which is the important property, because a bypass
 * path is exactly how authorization bugs get shipped.
 *
 * `cache()` is React's per-request memo. A layout and a page both calling
 * `api()` in the same render share one context (and therefore one session
 * lookup). It does NOT persist across requests.
 */
export const api = cache(async () => {
  const ctx = await createTRPCContext();
  return appRouter.createCaller(ctx);
});
