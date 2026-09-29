# healthStation — Interview README: How to Talk About This Project

> **Read this file out loud, twice, before the interview.** It is written the way you
> should actually talk — first person, concrete, honest. It maps the project to the job
> description you're interviewing for:
> full-stack ownership, AI-first working, healthcare-grade care, and a multi-tenant monorepo.
>
> **The single most important rule: never claim something that is not true.** Everything
> under "What is real" is real and you can point at code. Everything under "What is honest
> to admit" is missing — say it before they ask, then say what you would do next.
> An interviewer who catches you inflating gets defensive; one who sees you name your own
> gaps trusts your judgment everywhere else.

---

## 0. The one-sentence version (memorize this)

> "It's a multi-tenant telehealth storefront: a clinic owner signs up and *atomically* gets
> an account, a clinic, and a branded storefront, then manages categories and products from
> a predefined schema. Every clinic runs the same code and the same database, and the whole
> thing is built to prove one property — tenant isolation."

Then, the moment that makes them lean in (delivered as a drop, not a lecture):

> "The part most demos skip is the hard part: what stops Cairo's owner from reading or writing
> Alexandria's data? That's enforced in three layers — a UI guard, a procedure middleware
> check, and server-side `tenantId` injection. Only one of the three is ever the auth
> boundary, but all three have to agree."

---

## 1. The 60-second pitch (practice this word-for-word cadence)

1. **What it is.** A multi-tenant storefront platform for telehealth clinics. Two demo
   clinics seeded: Cairo Heart (red) and Alexandria Pediatrics (blue), 12 products each,
   different brands, zero shared data.
2. **The killer feature.** Self-serve onboarding — one form creates `user + tenant +
   storefront config + membership` in a single database transaction. A brand-new clinic is
   live and editable in seconds, no snapshot of code.
3. **The architecture in one breath.** Next.js App Router on the front, tRPC as the API
   boundary, Drizzle + PostgreSQL behind it, all in a pnpm monorepo so the backend source
   and the frontend share types — the API contract *is* TypeScript.
4. **The security story.** Session cookie → resolved to a user server-side → the requested
   `tenantSlug` is a *selector, not an authority* → a membership row decides if that user may
   act in *that* clinic → every insert stamps `tenant_id = ctx.tenant.id` from context, never
   from the request body. The schema is `.strict()` so a client cannot even *send* a
   `tenantId`, `sortOrder`, or `currency`.
5. **The close.** "You can follow one change from a form field, through a tRPC procedure,
   down a Drizzle query, to Postgres — without leaving the editor. That end-to-end ownership
   is the part of the JD I already live."

---

## 2. The 3-4 minute live demo script

Have these open/typed and click through in order.

| # | What you do | What you say |
|---|-------------|--------------|
| 1 | Sign up a fresh clinic (`/signup`) with any email | "One form creates four rows in one transaction — user, tenant, storefront config, membership. If any insert fails, they all roll back. A user with no tenant is a permanently broken account, so it's either all-or-nothing." |
| 2 | Land in `/{slug}/admin` dashboard | "Counts only — active products, categories, catalogue value, plus the two setup tasks that decide if the storefront looks finished: add a product, set your brand color." |
| 3 | Create a category, then a product (leave slug blank) | "The slug is derived from the name server-side, re-normalized even if hand-typed, and uniqueness is per-tenant — it's a composite `(tenant_id, slug)` index. Cairo and Alexandria can both sell 'omega-3'. A global unique slug would be a genuine multi-tenant bug." |
| 4 | Paste an **https R2 image URL** into the product, save | "Product images can be a repo-relative path or a direct https URL — my Cloudflare R2 bucket for real photos. The validator allows relative paths and `https://` URLs, and rejects everything else — `javascript:`, `data:`, `http://`, even protocol-relative `//host`. Both the form and the router run the same predicate so they can't drift." |
| 5 | Toggle a product's visibility off, reload the public shop | "Hiding is a soft delete — one boolean column. The storefront `product.list` filters `is_active = true`, and a direct URL to an inactive product is a 404. The admin table is the one place that shows active *and* hidden, because that's its job." |
| 6 | Open `/{newSlug}` public storefront | "Same codebase, this clinic's brand color, this clinic's categories and products. Nothing in the browser told it which clinic — the page resolved the tenant by slug server-side and injected a CSS variable for the brand color." |
| 7 | Edit the hero copy in admin, refresh the public page | "Config-driven storefront. The copy lives in a JSONB config column, rendered by a settings form. No deploy, no rebuild." |
| 8 | **The security moment** — signed in as Cairo's owner, try to load Alexandria's admin | "The layout guard redirects, and even if the browser is bypassed, calling a tRPC admin procedure against Alexandria returns `403 FORBIDDEN` from the `hasRole` middleware. It's a UX guard AND a real authorization check — two independent gates, so a mistake in either one is not a breach." |
| 9 | Show a product page with the "More in this category" strip | "`product.detail` returns `{ product, related }` in one call — product and siblings share a snapshot so the page can never contradict itself." |

> If time runs long, drop steps 4 and 7. Never drop 8.

---

## 3. How to talk about tRPC (the JD asks about it)

### The mental model — three sentences that are almost famous

1. **"A tRPC procedure is a typed function call across the network."** The signature *is*
   the API. No REST routes to discover, no OpenAPI to keep in sync — the client and server
   share one package, so when the server changes the return shape, the browser's type breaks
   at compile time.
2. **"The router is the boundary, and it runs on both sides of the wire in the same
   process."** In the browser it's the type source for the React hook. In a Route Handler it
   implements the HTTP endpoint. And in a Server Component it's called **in-process** —
   same router, same middleware, same input validation, zero network.
3. **"Authorization is middleware, not procedure code."** Every procedure is built on a
   chain (`publicTenantProcedure` vs `adminProcedure`). You add a route by composing the
   pre-checked chain — you don't re-write `if (user?.id)` inside each handler, so you can't
   forget it.

### The actual mechanics (point at these files)

- `server/context.ts` — the request starts here: it reads the session cookie from headers
  and hydrates `ctx.user` / `ctx.session` if a valid session row exists.
- `server/trpc.ts` — `initTRPC` with `superjson`. The chain is assembled as *composable
  pieces*:
  - `requestInfo` — correlation id.
  - `resolveTenant` — takes `tenantSlug` from the input, looks up the tenant row, puts
    `ctx.tenant` on the context.
  - `isAuthed` — rejects if no user/session (401).
  - `hasRole("owner","admin")` — queries `memberships` for **(this user, this tenant)**.
    Rejects with **403**, deliberately not 404, so you can't probe for the existence of
    clinics you don't belong to.
  - Built from those: `publicProcedure`, `publicTenantProcedure`, `protectedProcedure`,
    `tenantProcedure`, `adminProcedure`, `ownerProcedure`.
- `server/root.ts` — the `appRouter` bundle + `AppRouter` type export. That one export line
  *is* the client contract.
- `app/api/trpc/[trpc]/route.ts` — the only place tRPC actually runs over HTTP (the fetch
  adapter). Everything else is in-process.
- `server/caller.ts` — `api()` for React Server Components: `appRouter.createCaller(ctx)`.
  Calls the *same* chain so there's no "trusted" backdoor that skips `hasRole`. Wrapped in
  React's `cache()` so layout + page share one context per request.
- `utils/trpc.ts` — the browser client: `httpBatchLink`, `superjson` transformer, typed
  hooks from `AppRouter`.

### The two "gotcha" stories (interview gold — shows taste, from real pain)

1. **The transformer trap.** JSON has no `Date`. A Drizzle row is full of them. Without
   `superjson` declared on BOTH server and client, dates silently arrive as strings — no
   error, just wrong values. This is a five-minute bug that produces data corruption you
   can't see.
2. **The chained-input trap.** tRPC keeps only the *last* `.input()` parser at runtime. So
   every procedure declares `tenantSlug` itself rather than relying on a shared chained
   parser — otherwise `tenantSlug` silently drops out of validation. That's the kind of
   thing an LLM will copy from tutorials and get subtly wrong; I caught it by reading the
   generated validation, not trusting the pattern.

> Tie it to the JD's "AI as a real collaborator, judgment to meet the quality bar": *This
> whole project was built AI-first — Claude Code scaffolded, I verified. The spaces where
> I added judgment instead of accepting output: the middleware narrowing, the query shapes,
> the security invariants.* (See §7 for the full story.)

---

## 4. User-based authorization (you specifically asked for this — practice it)

### Say it in exactly this order

1. **"The browser never asserts identity."** It only *presents* a session cookie. The server
   resolves the cookie to a user row in `context.ts`. TypeScript carries that: `ctx.user` is
   `User | null` on a base context and non-null after `isAuthed` — the *compiler* verifies
   the authorization chain is in place.
2. **"`tenantSlug` is a selector, not an authority."** A client may freely *ask about* any
   clinic — that's how the public storefront works. Naming a tenant grants nothing.
3. **"Authority is a membership row."** `hasRole` runs *after* the tenant is resolved, and
   matches `(user_id, tenant_id)` against the requested tenant. Membership for the wrong
   tenant is not good enough. Roles are `owner` / `admin`, stored in the membership.
4. **"The input schema is the last line of defense against a lying client."**
   `productCreateInputSchema` is `.strict()`: unknown keys like `tenantId`, `sortOrder`, or
   `currency` are rejected with a 400. The row is written with `tenantId:
   ctx.tenant.id` — from context, never from the body.
5. **"Public reads and admin writes are two branches of one middleware chain."** Students of
   this design fall into the trap of making everything require a login — which would make the
   public storefront unreachable. The two branches share the exact same tenant resolution and
   differ in exactly one place: whether a membership is required. That asymmetry is visible
   on one screen (`server/trpc.ts`).

### The three defense layers (memorize the interview line)

> **UI:** `checkRole()` in the admin layout — UX, don't render what they can't use.
> **API:** the tRPC middleware — the actual authorization.
> **Data:** tenantId stamped from server context + composite indexes — the backstop if an app
> bug ever forgets a filter.

> **Honest note (say it):** Row-Level Security is designed in and is the next task, but with
> the middleware chain plus server-side stamping it is not yet implemented. If they ask
> "where's RLS?" — say exactly that, then describe the policy you'd write
> (`USING (tenant_id = current_setting('app.tenant_id')::uuid)`, `WITH CHECK` on inserts).
> See §8.

### The one diagram worth drawing on the whiteboard

```
Browser (cookie: ses_<id>)
   │  GET /{slug}/shop
   ▼
Next RSC  ── api() createCaller (in-process, NO http hop)
   ▼
middleware chain
   requestInfo → resolveTenant(tenantSlug)
      └─ publicTenantProcedure …… read storefront/categories/products
      └─ isAuthed → tenantProcedure → hasRole("owner","admin")
         └─ adminProcedure …… write everything
ctx = { user, tenant, role, membership }   // resolved ONCE, server-side
   ▼
Drizzle db (every query: WHERE tenant_id = ctx.tenant.id)
   ▼
PostgreSQL  (tenant_id everywhere, composite unique slugs)
```

---

## 5. Feature tour mapped to the JD

| JD line | What you say |
|---------|--------------|
| "Follow a feature from the interface through the API to the database" | "A product edit: the React Hook Form validates against a zod schema, submits to `product.update`, which re-runs the create-time category-ownership and slug-collision checks, and returns the joined row. One file each for schema, router, form — and the schema file is *shared* between browser and server so the two can't drift." |
| "Well-architected patterns that make the next feature faster" | "Reusable pieces: the middleware-chain builders, a shared `toProductView` mapper so admin/detail/update all return the same shape, and a `lib/storefront-types.ts` view-model layer that strips `tenantId`/`isActive` from public cards — you can't leak a field that isn't in the type." |
| "Performance" | "The shop is the hottest read. It runs exactly two queries — `count(*)::int` plus the page — and it's served by `(tenant_id, is_active)`, an index that exists because the query filters on both. Pagination and page size are capped server-side. React Server Components call the router in-process, so there's no self-HTTP round trip." |
| "Accuracy / money" | "All money is integer cents — IEEE floats can't represent 0.1 + 0.2. `priceCents` is validated with `.int()` and capped at $1,000,000 server-side; the form converts a dollar string in the browser." |
| "Accessibility" | "Server components render the content, client islands only the interactive bits. State is announced, not just drawn — `role="alert"` on form errors, status text in `sr-only` for screen readers, `aria-pressed` on the visibility toggle." |
| "Reliability / honest-to-god tradeoffs" | "DB sessions instead of JWT — a revoked login dies at once via one indexed lookup, not at token expiry; the cost is one query per request. `httpOnly` + `sameSite=lax` cookies: XSS can't read them, CSRF is blocked, no extra library." |
| "Healthcare-grade care" | "A 409 slug collision gives the exact conflicting product name. Inactive products 404 rather than resurrecting via deep link. Payments live behind a disabled button — I'm not showing a working 'buy' button with no cart." |
| "0 → 1 instinct" | "I chose the scope: skip consumer accounts and buy buttons in phase one, keep the security invariants absolute. I ship in vertical slices — auth, then storefront, then admin — and verify each with a scripted smoke test before moving on." |

---

## 6. Vocabulary — drop these, know what each means

- **Composite uniqueness** — `(tenant_id, slug)` indexes; two clinics share slugs safely.
- **Selector vs authority** — `tenantSlug` asks; membership grants.
- **Three defense layers** — UI guard / middleware / server-side stamping (+RLS backing).
- **Two procedure branches** — public vs admin, differing only on membership.
- **In-process caller** — RSC → `createCaller`, no self-HTTP hop.
- **Strict input schema** — `.strict()` rejects a lying body (tenantId, sortOrder…).
- **Superjson transformer** — both ends, or dates rot silently.
- **Soft delete** — `is_active` boolean; storefront hides, admin table (and future order
  history) keeps.
- **View-model layer** — components never see Drizzle rows; can't render what's not typed.
- **count(*)::int** — Postgres `bigint` arrives as a string in Node; the cast keeps `total`
  a number.
- **anti-user-enumeration login** — a dummy bcrypt hash is always compared, so an unknown
  email costs the same ~250ms as a known one. Identical message *and* timing.

---

## 7. The AI-first story (the culture this role describes — make it yours)

This project was built the exact way the role post describes working: **AI as a default
collaborator, not a side experiment.** Have a crisp answer ready:

> "Everything here was drafted and reviewed with Claude Code in the loop — schemas, routers,
> the middleware chain, forms. But the value wasn't 'type the prompt, accept the code'.
> Claude got the Drizzle join right, then I caught the SQL-narrowing and the fragment-column
> trap by *reading the generated SQL it printed*. It proposed a refactor, I rejected it
> because it would have widened `ctx.user` to nullable. That's the workflow: AI for velocity,
> my judgment for the quality bar — especially where healthcare trust is at stake."

Storage of one concrete proof point: **the Drizzle 0.45 trap.** Columns interpolated into
raw SQL *inside* a correlated subquery render unqualified. Claude generated queries using a
pattern that looked right; a review of logged SQL caught that it was wrong, and the rewrite
(plain expressions + `count(*)::int`) eliminated the whole class. Be ready to tell it in two
sentences.

---

## 8. Honest limitations — say these *before* they ask

Ask for it and it becomes a strength (owning constraints is the entrepreneurial/end-to-end
signal they hired for):

| Not built | What it is | What you'd do |
|-----------|-----------|---------------|
| Row-Level Security | Defense layer 3 not implemented | Next task. Policy: helper `set_config('app.tenant_id', ...)` at connection start, `USING (tenant_id = current_setting('app.tenant_id')::uuid)` on tenant-owned tables, `WITH CHECK` on inserts. Then prove an un-scoped query returns zero rows. |
| Unit test suite | Verification so far was lint + typecheck + scripted HTTP smoke tests | Adopt Vitest + `supertest`-style tRPC caller tests; property-test authz (every admin procedure × cross-tenant input = 403). |
| Deploy | Runs on `localhost:3000` | Target: SST (the JD's stack) + Neon Postgres, CDN for R2 images, env-separated apps. |
| Prisma | We chose Drizzle | Fit: SQL fidelity, typed `jsonb` for config/details, no codegen step, lighter cold starts. Honest trade: Prisma's ecosystem/ecosystem docs are larger. |
| Consumer accounts, cart, checkout | Out of scope by design | Explicit scope cut per FEATURES.md — commerce mechanics are the platform's, not the clinic's, when they arrive. |

---

## 9. Anticipated questions (practice these answers)

- **"How do you stop cross-tenant data leaks?"** — Three layers, then the stamping rule:
  `tenantId` always from `ctx.tenant.id`, never from input; `.strict()` schema rejects a body
  that tries to send one.
- **"Why multi-tenant/shared schema instead of a DB per customer?"** — Migration velocity:
  one migration ships to every clinic. Revisit dedicated instances for hard compliance needs.
- **"Why Drizzle over Prisma?"** — SQL fidelity, typed jsonb, no codegen, Lambda cold start.
  (The job description names Prisma — say Drizzle was a deliberate, comparable call and why.)
- **"Why DB sessions over JWT?"** — Revocability: ban a user and access dies at once, via
  one indexed lookup, not at token expiry.
- **"Why same-site httpOnly cookies?"** — XSS can't exfiltrate them; `sameSite=lax` kills
  CSRF; no CSRF library dependency.
- **"What if signup fails halfway?"** — It can't leave a broken user: the four inserts are
  one transaction. A user with no tenant is an orphan, so it's all-or-nothing.
- **"Why are categories a real table?"** — A product must not be able to point at another
  clinic's category. A table + tenant-scoped ownership check makes mislabelling fail loudly;
  a text column can't enforce it.
- **"Why do public reads not require auth?"** — Consumers have no account by design. The
  two procedure branches split exactly there.
- **"How do you prevent user enumeration on login?"** — Dummy bcrypt compare + identical
  message + identical timing.
- **"What would you add for real PHI?"** — Audit log on every PHI read in the same
  transaction as the mutation, SSO/OAuth for EMR integration, BAA-backed hosting.
- **"Talk us through a recent bug you actually fixed."** — Any of: the fragment-column SQL
  trap, the chained-input tRPC trap, the missing `storefronts` row on signup (a new tenant
  had nothing to render), or shipping a `bigint` count as a string until the `::int` cast.
- **"How does AI fit how you build?"** — §7. Lean in; this is the JD's own line.
- **"What's the next thing you'd build?"** — RLS first (close the three-layer story), then a
  real test suite — both one paragraph each, with the exact policy and tooling.

---

## 10. Practice rituals (do these in the next hour)

1. **Two-minute talk.** Set a timer, give the §1 pitch + the §2 demo script up to step 8,
   out loud, to a wall. Do it twice.
2. **Whiteboard drill.** Draw the §4 diagram from memory. Then draw the three defense layers.
   Then the two procedure branches.
3. **The 60-second dirty Q&A.** Randomize §9 and answer in ≤60s each. You should never go
   silent — you know this codebase.
4. **Hot reload facts.** Logins: `cairo@demo.test` / `alex@demo.test`, password
   `Password123!`. Clinics: `cairo-heart` (red #B91C1C), `alexandria-pediatrics` (blue
   #2563EB), 12 products each. Port 3000. Reset seed with `pnpm seed -- --reset`.