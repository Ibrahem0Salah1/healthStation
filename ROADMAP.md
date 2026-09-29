# ROADMAP.md — Multi-Tenant Telehealth Storefront

**Project root:** `C:\work\multi-tenant`
**Read `INSTRUCTIONS.md` first** — project rules, hard security invariants, scope guard.
**Read `FEATURES.md`** — scope, actors, data model. It is the source of truth for *what*.
**Read `ContextMultTenant.md`** — the map of what exists and why.

> **Working agreement (overrides `INSTRUCTIONS.md` §3).** The assistant writes the files
> directly; the developer reviews and runs them. Explanations are delivered as short
> *why-this-design* notes at the point of the code, not as a full 5-part lecture.
> Security implications are still called out explicitly, every time.

---

## 0. The Demo in One Sentence

A clinic owner signs up, which atomically creates their account, their clinic tenant, and that
tenant's storefront config. They manage categories and products from a predefined schema. The
public site at `/{slug}` is generated from that configuration — one codebase, one database,
provable tenant isolation.

---

## 1. Architecture (memorize this diagram)

```
[ Browser ]  React Server Components call the tRPC client directly (no HTTP hop)
     │  trpc.product.list.useQuery({ tenantSlug, categorySlug })
     ▼
[ Next.js Route Handler ]  /api/trpc  (fetch adapter)   ← the only place tRPC runs over HTTP
     ▼
[ tRPC ]  router → middleware chain → procedure
     │      public  → publicTenantProcedure   (anonymous consumer)
     │      isAuthed → withTenant → hasRole  (clinic owner)
     │      ctx = { user, tenant, role }   ← resolved ONCE, server-side
     ▼
[ Drizzle ORM ]  db.query.products.findMany({ where: eq(tenantId, ...) })
     ▼
[ PostgreSQL ]  one DB, many tenants, tenant_id column, RLS backstop
```

### The four building blocks

| Concept | Job in one sentence |
|---------|--------------------|
| **Monorepo** | One repo so backend source and frontend share types — TypeScript becomes the API contract |
| **Multi-tenancy** | One database serves many clinics; every row stamped with `tenant_id` |
| **tRPC** | Replaces hand-written REST; the procedure's signature *is* the contract |
| **Drizzle** | Turns a TypeScript schema into typed SQL queries and migrations |

---

## 2. Data Model (as built — `packages/database/src/schema.ts`)

```
   tenants ──────┬──────< categories ──────< products
      │           │
      │           └──────< memberships >────── users ──────< sessions
      │
      └────── storefronts   (1:1, config jsonb, UNIQUE(tenant_id))
```

| Table | Key columns | Notes |
|-------|-------------|-------|
| `tenants` | `slug` **globally unique**, `name` | A URL must resolve to exactly one clinic, so this unique is deliberately *not* tenant-scoped |
| `users` | `email` unique, `passwordHash` | |
| `memberships` | `tenantId` FK, `userId` FK, `role` enum | Surrogate `id` PK + `UNIQUE(tenant_id, user_id)`. `tenantId` is **denormalized on purpose** so RLS policies need no join |
| `storefronts` | `tenantId` FK **unique**, `config` jsonb `$type<StorefrontConfig>` | One config per clinic, DB-enforced. Better than a column on `tenants`: "one config per clinic" becomes a constraint |
| `categories` | `tenantId` FK, `slug`, `sortOrder` | `UNIQUE(tenant_id, slug)` — **per tenant** |
| `products` | `tenantId` FK, `categoryId` FK **nullable**, `priceCents`, `details` jsonb | `UNIQUE(tenant_id, slug)` — **per tenant** |

### The three facts that are load-bearing

1. **`tenantId` is denormalized onto every tenant-owned table** (including `memberships`, which
   could derive it by join). An RLS policy can only reference columns *in the row being
   filtered*; deriving tenant through joins would make the policy recurse infinitely, and
   Postgres forbids it.
2. **Uniqueness is per tenant.** Clinic A and Clinic B must both be able to sell
   "vitamin-d" and both have a "Pain Relief" category. A bare `UNIQUE (slug)` is a genuine
   multi-tenant bug, not a stylistic choice.
3. **Money is `integer` cents.** `0.1 + 0.2 === 0.30000000000000004` in IEEE-754.

### Indexes derive from queries (not habit)

| Index | Kind | Query it serves |
|-------|------|-----------------|
| `tenants_slug_key` | uniqueness | Resolve `/{tenantSlug}` on every request |
| `users_email_key` | uniqueness | Login lookup |
| `memberships_tenant_user_uidx` | uniqueness | "is this user a member of this tenant?" — the `hasRole` check |
| `memberships_user_id_idx` | performance | "which clinics am I in?" |
| `storefronts_tenant_id_key` | uniqueness | One config per clinic |
| `categories_tenant_slug_uidx` | uniqueness | Category page URL, per tenant |
| `categories_tenant_id_idx` | performance | Storefront category nav |
| `products_tenant_slug_uidx` | uniqueness | Product detail URL, per tenant |
| `products_tenant_active_idx` | performance | `/shop` — hottest query. `(tenant_id, is_active)` not `(is_active)`: a boolean is ~50% true, so a bare boolean index matches half the table and Postgres ignores it |
| `products_tenant_category_idx` | performance | `/category/[slug]` and the `/shop` filter |
| `sessions_user_id_idx` | performance | Revoke every session for a user |
| `sessions_expires_at_idx` | performance | Scheduled cleanup of expired sessions |

> **Constraint vs index.** A *constraint* is a correctness rule the DB enforces. An *index* is a
> performance structure that only helps a query. An index merely helps a unique constraint —
> the reverse is false.

---

## 3. Three Defense Layers (all three must be demonstrable)

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **UI** | `requireRole()` in `admin/layout.tsx` | UX — don't render what they can't use |
| **API** | `hasRole` tRPC middleware | **the actual authorization** |
| **Data** | PostgreSQL Row-Level Security | integrity backstop if application code has a bug |

**Interview line:** *"An owner of Cairo Heart hitting `/alexandria-pediatrics/admin` gets
redirected by the layout. Calling the tRPC endpoint directly without a membership gets
`403 FORBIDDEN` from `hasRole`. And if a query ever forgot its `tenant_id` filter, Postgres RLS
returns zero rows regardless. Any one alone is bypassable — that's why there are three."*

### The two procedure branches (this is the part people get wrong)

| Branch | Chain | Who | Reads | Writes |
|--------|-------|-----|-------|--------|
| **Public** | `publicTenantProcedure` | anonymous consumer | storefront, categories, products | never |
| **Admin** | `adminProcedure` | clinic owner (`isAuthed` → `withTenant` → `hasRole`) | everything | storefront config, categories, products |

A public branch is **required**, not optional: `FEATURES.md` §2 says consumers have no account.
If tenant resolution only lived behind `isAuthed`, the entire public storefront would be
unreachable. The two branches differ in exactly one place — whether a membership is required —
and that asymmetry is the thing to be able to explain.

---

## 4. File Structure (as built + planned)

```
C:\work\multi-tenant\
├─ INSTRUCTIONS.md · ROADMAP.md · FEATURES.md · ContextMultTenant.md
├─ package.json · pnpm-workspace.yaml · .env.example
│
├─ packages/database/              # imports NOTHING from apps/
│  ├─ drizzle.config.ts
│  └─ src/{schema,relations,db,seed,index}.ts
│
└─ apps/web/
   ├─ next.config.ts               # turbopack.root + transpilePackages
   ├─ components/ui/               # shadcn, owned source
   ├─ lib/utils.ts                 # cn()
   ├─ app/
   │  ├─ layout.tsx · page.tsx     # root layout + landing page
   │  ├─ globals.css               # design tokens + mesh backgrounds
   │  ├─ login/page.tsx            # PHASE 5
   │  ├─ signup/page.tsx           # PHASE 5
   │  ├─ api/auth/{signup,login,logout}/route.ts
   │  ├─ api/trpc/[trpc]/route.ts
   │  └─ [tenantSlug]/
   │     ├─ layout.tsx             # resolve tenant ONCE + theme CSS vars
   │     ├─ page.tsx               # storefront from config
   │     ├─ shop/page.tsx
   │     ├─ product/[productSlug]/page.tsx
   │     ├─ category/[categorySlug]/page.tsx
   │     └─ admin/
   │        ├─ layout.tsx          # requireRole() — UX layer only
   │        ├─ page.tsx · storefront/page.tsx
   │        ├─ products/page.tsx · products/new/page.tsx
   │        └─ categories/page.tsx
   ├─ server/
   │  ├─ trpc.ts                   # t instance + middleware chain
   │  ├─ context.ts · auth.ts · root.ts
   │  ├─ guards.ts                 # requireRole() for Server Components
   │  └─ routers/{tenant,category,product}.ts
   ├─ components/
   │  ├─ templates/main/sections/  # landing page sections
   │  ├─ auth/                     # LoginForm, SignupForm, AuthShell
   │  ├─ storefront/blocks/        # Header, Hero, Categories, FeaturedProducts, Footer
   │  └─ admin/                    # forms for products/categories/storefront
   └─ utils/trpc.ts                # createTRPCReact + httpBatchLink
```

---

## 5. Status

| Phase | Task | Status |
|-------|------|--------|
| 0 | Orientation (concepts) | ✅ 3/3 |
| 1 | Workspace Scaffold | ✅ 4/4 |
| 2.1 | PostgreSQL in Docker | ✅ |
| 2.2 | 6-table schema (7 incl. `sessions`) | ✅ |
| 2.3 | `drizzle.config.ts` + push | ✅ |
| 2.4 | `relations.ts` | ✅ |
| 2.5 | `db.ts` (globalThis cache, `prepare: false`) | ✅ |
| 2.6 | `seed.ts` — 2 clinics, 2 owners, 12 products each | ✅ |
| 2.7 | Row-Level Security | ⬜ **not started** |
| 3.1 | `initTRPC` + context + superjson | ✅ |
| 3.2 | `context.ts` — session → user | ✅ |
| 3.3 | Fetch adapter route handler | ✅ |
| 3.4 | `tenant` router — `getBySlug` | ⬜ |
| 3.5 | `category` + `product` routers | ⬜ |
| 3.6 | tRPC React client + provider | ⬜ |
| 3.7 | curl smoke tests | ⬜ |
| 4.2 | `server/auth.ts` — sessions | ✅ |
| 4.3 | Signup route, bcryptjs, slug-collision UX | ✅ (incomplete — see 5.1) |
| 4.4 | Login + logout routes | ✅ |
| 4.6 | Middleware chain | ✅ (public branch missing — see 5.2) |
| 4.5 | Sign up / log in **UI** | ⬜ |
| 5.1 | `[tenantSlug]/layout.tsx` — resolve tenant + theming | ⬜ |
| 5.2 | `publicTenantProcedure` | ⬜ |
| 5.3 | Storefront blocks from config | ⬜ |
| 5.4 | `/shop` filters + pagination | ⬜ |
| 5.5 | `/product/[productSlug]`, `/category/[categorySlug]` | ⬜ |
| 5.6 | Unknown tenant → 404 | ⬜ |
| 6.1 | `requireRole()` in `admin/layout.tsx` | ⬜ |
| 6.2 | Product form on a predefined schema | ⬜ |
| 6.3 | Category management | ⬜ |
| 6.4 | Block editor (storefront config) | ⬜ |
| 7.1 | Cross-tenant denial tests | ⬜ |
| 7.2 | README as an interview artifact | ⬜ |
| 7.3 | RLS policies | ⬜ |
| 7.4 | Deploy + 3-minute walkthrough | ⬜ |

### Defects found in review (fixed in this pass unless noted)

| # | Defect | Severity | Status |
|---|--------|----------|--------|
| 1 | shadcn components referenced `--primary`, `--input`, `--ring`, `--secondary`, `--destructive` — **none were declared**. Tailwind v4 emits no class for an undeclared token, so `bg-primary` rendered as *no background*, silently | High | ✅ fixed |
| 2 | Signup transaction created `user + tenant + membership` but **no `storefronts` row**. `config` is `NOT NULL` and the whole storefront reads from it — a self-serve tenant had nothing to render | High | ✅ fixed |
| 3 | `withTenant` hung off `protectedProcedure`, so **anonymous consumers could not read anything** — the entire public storefront was unreachable | High | ✅ fixed (`publicTenantProcedure`) |
| 4 | No tRPC React client. `@trpc/react-query`, `@tanstack/react-query`, `superjson` installed but unused; a client without the matching transformer corrupts `Date` | High | ✅ fixed |
| 5 | Landing page hotlinks a video from `qclay.design` — a third-party asset that will 404 and is a supply-chain dependency | Low | ✅ removed |
| 6 | Leftover `e2e-test-clinic` tenant with 0 products in the database | Low | ⬜ run `pnpm seed -- --reset` |
| 7 | **Zero git commits** despite `git init` having run | Medium | ⬜ `git add . && git commit` |
| 8 | RLS (defense layer 3) not implemented | Medium | ⬜ Phase 7.3 |

---

## 6. Remaining Work, in build order

Each item depends on the one above it. Do not skip ahead.

### 6.1 Close the auth loop
- [ ] `/login` and `/signup` pages, styled from the landing page's tokens
- [ ] Forms POST to the existing route handlers, surface `409` / `401` as field-level errors
- [ ] Redirect into `/{slug}/admin` after signup

### 6.2 Public tenant read path
- [ ] `publicTenantProcedure` — resolve tenant by slug, no membership
- [ ] `tenant.getBySlug` → tenant + storefront config
- [ ] `category.list`, `product.list` (filters + pagination), `product.getBySlug`
- [ ] curl smoke tests **before** any UI

### 6.3 Storefront
- [ ] `[tenantSlug]/layout.tsx` — resolve tenant once, expose it, inject `--tenant-primary` CSS var
- [ ] Blocks rendered from `StorefrontConfig` via a string→component registry
- [ ] `/shop`, `/product/[slug]`, `/category/[slug]`
- [ ] Unknown slug → `notFound()`

### 6.4 Admin
- [ ] `requireRole()` in `admin/layout.tsx` — UX layer, **not** the authorization
- [ ] Product list + create form, Category list + create
- [ ] Storefront block editor (hero copy, brand color, show/hide)
- [ ] Prove `tenantId` is injected server-side: point the client at tenant B while signed in
  as tenant A's owner and show the `403`

### 6.5 Proof
- [ ] Cross-tenant denial test
- [ ] RLS policies (`USING` + `WITH CHECK`)
- [ ] README as an interview artifact
- [ ] Deploy + walkthrough

---

## 7. Scope Guard

**Never cut:** the tRPC middleware chain, `tenantId` server-side injection, the atomic signup
transaction, the block editor, the README.

**Cut order if behind:** pagination on `/shop` → Categories block on home →
`/category/[categorySlug]` → deploy → RLS.

**Out of scope** (`INSTRUCTIONS.md` §5): cart/checkout/payments, consumer accounts, real file
uploads, real drag-and-drop builder, appointments/video/prescriptions/EMR, email verification,
password reset.

---

## 8. The 3-Minute Interview Demo Script

1. **"Self-serve onboarding."** Sign up live — watch one form create user + tenant + storefront
   + membership in one transaction, then land in the admin dashboard.
2. **"Same codebase, two clinics."** `/cairo-heart` red, 12 products. `/alexandria-pediatrics`
   blue, different 12. One deployment.
3. **"Config-driven storefront."** Edit the hero in admin, save, refresh the public site. Changed.
   No rebuild, no deploy.
4. **"Tenant resolution happens once."** Trace layout → context → middleware chain.
5. **"The key design decision."** Point at `product.create`: `tenantId: ctx.tenant.id`, injected
   server-side, never from input. *"A user tampering with the request body cannot write into
   another tenant's data."*
6. **"The part most demos skip."** Signed in as `cairo@demo.test`, curl the Alexandria admin
   mutation → `403 FORBIDDEN` from `hasRole`.
7. **"And the backstop."** Show the RLS policy.
8. **"The index came from the query."** `(tenant_id, is_active)` exists because `/shop` filters
   on it. Schema designed from the access pattern, not by habit.
9. **"A schema decision worth mentioning."** Categories are a real table with a real FK, not a
   text column — otherwise a product could point at another tenant's category.

---

## 9. Seed Data

```
Clinic "cairo-heart"           → cairo@demo.test   (owner)  primary #B91C1C (red)
Clinic "alexandria-pediatrics" → alex@demo.test    (owner)  primary #2563EB (blue)
password (both): Password123!
```

Different brand colors, different categories, different products, **zero shared memberships** —
makes the cross-tenant denial test trivial to demonstrate.

---

## 10. Anticipated Interview Questions

| Question | Answer |
|----------|--------|
| How do you prevent cross-tenant data leaks? | 3 layers: layout guard (UX) → `hasRole` middleware (authz) → RLS (integrity). `tenantId` always from session context, never input. |
| Why shared-schema over database-per-tenant? | Migration velocity and cost at scale — one migration ships to every clinic. Revisit dedicated DBs for customers with hard compliance needs. |
| Why Drizzle over Prisma? | Lambda cold-start cost, SQL fidelity, typed `jsonb`, no codegen step. |
| Why DB sessions over JWT? | Revocability — ban a user and access dies at once via one indexed lookup, not at token expiry. The cost is one query per request. |
| Why same-site cookies? | `httpOnly` blocks XSS exfiltration; `sameSite=lax` blocks CSRF. No separate CSRF library needed. |
| What if signup fails halfway? | It's wrapped in a transaction. A user with no tenant is a permanently broken account — an orphaned row, not a user. |
| Why is `categories` a table and not a text field? | Foreign keys make cross-tenant category references structurally impossible, and make the filter indexed. |
| Why do public reads not require auth? | Consumers have no account by design. The split is one branch in the middleware chain: `publicTenantProcedure` resolves the tenant, `adminProcedure` additionally requires a membership. |
| How do you prevent user enumeration on login? | A dummy bcrypt hash is always compared, so an unknown email costs the same ~250ms as a known one. Identical message *and* identical timing. |
| Why are CTA buttons fixed? | Content is configurable; commerce mechanics are not. Owning the checkout flow is what keeps it safe and correct for every tenant. |
| What would you add for real PHI? | Audit log on every PHI read (same transaction as the mutation), SSO/OAuth for EMR integrations, BAA-backed hosting. |
