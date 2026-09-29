# healthStation

**A multi-tenant telehealth storefront platform.** A clinic owner signs up and, in one database transaction, gets an account, a clinic, and a branded storefront — then manages categories and products from a dedicated admin portal. Every clinic runs the same code and the same PostgreSQL database, with tenant isolation enforced in depth.

---

## Table of contents

- [Why healthStation](#why-healthstation)
- [Features](#features)
- [Tech stack](#tech-stack)
- [How tenant isolation works](#how-tenant-isolation-works)
- [Database schema](#database-schema)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Demo data](#demo-data)
- [Deploying](#deploying)
- [Roadmap](#roadmap)

---

## Why healthStation

Telehealth clinics need a storefront fast, but a clinic site is mostly plumbing: accounts, tenancy, categories, products, pricing, branding, and the *hard part* — making sure one clinic can never read or write another's data.

healthStation is a reference-quality build of exactly that plumbing:

- **One codebase, many clinics.** The same Next.js app serves every clinic; which clinic you're looking at is resolved from the URL at request time.
- **Atomic onboarding.** One signup form creates `user + tenant + storefront config + membership` in a single transaction — all or nothing.
- **Config-driven storefronts.** Hero copy, brand color, announcement, and category nav live in a typed `jsonb` config edited from the admin portal. No deploy, no rebuild.
- **Tenant isolation as the core property.** Three independent defense layers, so a mistake in any one of them is not a breach.

---

## Features

| Feature | What it does |
|---|---|
| Self-serve clinic onboarding | One form creates account, clinic, storefront, and ownership in a single transaction — a failed insert rolls everything back. |
| Branded public storefront | Hero, brand color, trust badges, announcement bar, category navigation — all driven by per-clinic config. |
| Product catalog | Categories + products with typed structured details (generic/prescription flags, pack size, active ingredients), per-clinic slugs, and explicit ordering. |
| Config editor | Admin portal edits the JSONB storefront config live — copy and theme changes appear with a refresh, no redeploy. |
| Soft delete | `is_active` boolean hiding instead of destroying rows; inactive products 404 on the storefront but remain visible in admin. |
| Product images | Repo-relative path (`/products/….svg`) or a direct `https://` URL (e.g. a Cloudflare R2 bucket); everything else is rejected. |
| Money as integer cents | `priceCents` integer column — no floating-point cents; validated `.int()` and capped server-side. |
| DB-backed sessions | Opaque 256-bit token as the session id; revocable instantly, `httpOnly` + `sameSite=lax` cookies. |
| Anti-user-enumeration login | A dummy bcrypt hash is always compared, so unknown emails cost the same time and return the same message as known ones. |
| Paginated shop | `count(*)::int` + page query, page size capped server-side, indexed for "active products of clinic X". |
| Shared validation | Exactly one zod schema per resource, imported by both the browser form and the server router — they cannot drift. |
| Type-safe API | tRPC end-to-end: the client and server share types, and the API boundary is the router written once, run in-process for RSC and over HTTP for the browser. |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend / SSR | Next.js 16 (App Router) + React 19 | Server components render the storefront; client islands handle forms and toggles. |
| API boundary | tRPC v11 + superjson | The router *is* the contract; shared TypeScript types; `Date` safety via `superjson` on both ends. |
| ORM | Drizzle 0.45 + postgres.js (`prepare: false`) | SQL fidelity, typed `jsonb`, no codegen. `prepare: false` is deliberate — serverless Postgres sits behind PgBouncer, which can't guarantee the same backend for PREPARE/EXECUTE. |
| Database | PostgreSQL 17 (+ pgcrypto-managed UUIDs) | Standard choice; demo runs a Docker container, production targets managed Postgres (Neon etc.). |
| Validation | zod 4 | Form schemas and tRPC input schemas are the same files. |
| Auth | DB sessions + bcrypt (bcryptjs) | Revocable sessions over revocable-at-expiry tokens; no extra auth library. |
| Monorepo | pnpm workspaces | `apps/web` (app) + `packages/database` (schema, relations, seed) share one install and one lockfile. |

---

## How tenant isolation works

`tenantSlug` in a URL is a **selector, not an authority**. Naming a clinic grants nothing — authority comes from a membership row. The defense is layered:

| Layer | Mechanism | File |
|---|---|---|
| 1 · UI | The admin layout checks the viewer's role and doesn't render what they can't use. | `apps/web/app/[tenantSlug]/admin/layout.tsx` |
| 2 · API | `hasRole("owner","admin")` middleware resolves the requested tenant from input, then checks `(user_id, tenant_id)` against `memberships`. Rejects with **403** — deliberately not 404, so clinic existence can't be probed. | `apps/web/server/trpc.ts`, `apps/web/server/guards.ts` |
| 3 · Data | Every insert stamps `tenantId` from server context, never from the request body — and every query is tenant-scoped by construction. | routers in `apps/web/server/routers/` |

Supporting invariants:

- **Strict input schemas** — `.strict()` rejects bodies carrying `tenantId`, `sortOrder`, or `currency`; the client can't even *send* them.
- **Composite uniqueness** — `(tenant_id, slug)` on categories and products: Cairo and Alexandria can both sell *"Omega-3"*. A global unique slug would be a genuine multi-tenant bug.
- **Proper index ordering** — every query is tenant-scoped first, so indexes lead with `tenant_id`, then narrow by `is_active` or `category_id`. A bare boolean/`category_id` index matches half the table and Postgres would ignore it.
- **No backdoor** — React Server Components call the router in-process via `api()` (`createCaller`), running the *same* middleware chain. There is no "trusted" caller that skips `hasRole`.

Public reads and admin writes are **two branches of one middleware chain**: they share tenant resolution and differ in exactly one place — whether membership is required. That asymmetry is visible on a single screen (`server/trpc.ts`).

---

## Database schema

| Table | Purpose | Notable constraints |
|---|---|---|
| `tenants` | One row per clinic | `slug` unique |
| `users` | One row per person (may belong to many clinics) | `email` unique, bcrypt hash |
| `memberships` | Who may act in which clinic, and as what | `(tenant_id, user_id)` unique; `role` enum `owner`/`admin` |
| `storefronts` | Per-clinic branding + copy | `tenant_id` unique (one storefront per clinic); typed `jsonb config` |
| `categories` | Clinic product groupings | `(tenant_id, slug)` unique; explicit `sort_order` |
| `products` | The catalog itself | `(tenant_id, slug)` unique; `price_cents` integer; `is_active` soft delete; `details` typed `jsonb`; nullable `category_id` (uncategorized products are real) |
| `sessions` | Server-side auth sessions | PK is the opaque token itself (64 hex chars); indexed by user and by expiry for cleanup |

All timestamps are timezone-aware with `defaultNow()`. Foreign keys cascade: deleting a tenant removes its storefront, categories, products, and memberships.

---

## Project structure

```
healthstation/
├── apps/web/                      # Next.js 16 App Router application
│   ├── app/                       # Pages & route handlers
│   │   ├── [tenantSlug]/          # Storefront: /, /shop, /category/…, /product/…
│   │   ├── [tenantSlug]/admin/    # Admin portal: dashboard, products, categories, config
│   │   ├── api/auth/              # login / signup / logout route handlers
│   │   └── api/trpc/[trpc]/       # The only HTTP entry point for tRPC
│   ├── components/                # auth, storefront blocks, admin forms, UI primitives
│   ├── lib/                       # zod schemas (shared browser+server) & view-models
│   ├── server/                    # tRPC context, middleware chain, routers
│   └── utils/trpc.ts              # Typed browser client
└── packages/database/             # Shared data layer
    └── src/
        ├── schema.ts              # Typed Postgres schema
        ├── relations.ts           # Drizzle relations
        ├── db.ts                  # Postgres client + typed Drizzle instance
        └── seed.ts                # Demo clinics with transactional seeding
```

---

## Getting started

**Prerequisites:** Node.js ≥ 20, pnpm 9, Docker (for the local Postgres), and the `.env` file.

```bash
# 1. Install
pnpm install

# 2. Start a local Postgres
docker run -d \
  --name healthstation-pg \
  -e POSTGRES_PASSWORD=postgres \
  -v healthstation-pgdata:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:17-alpine
```

```env
# .env  (repo root — this project reads exactly one `.env`)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

```bash
# 3. Create the schema (the codebase uses `db:push`, no migration folder)
pnpm db:push

# 4. Seed the two demo clinics
pnpm seed

# 5. Run it
pnpm dev        # → http://localhost:3000
```

> `pnpm seed -- --reset` wipes and reseeds every table. The script refuses to run a reset when `NODE_ENV=production`, so a live database can't be destroyed by accident.

---

## Scripts

| Command | Package | What it does |
|---|---|---|
| `pnpm dev` | `@repo/web` | Next.js dev server (Turbopack) on port 3000 |
| `pnpm build` | `@repo/web` | Production build |
| `pnpm typecheck` | all | `tsc --noEmit` across the workspace |
| `pnpm db:push` | `@repo/database` | Push the Drizzle schema to Postgres |
| `pnpm db:generate` | `@repo/database` | Generate SQL migrations from the schema |
| `pnpm db:migrate` | `@repo/database` | Apply generated migrations |
| `pnpm db:studio` | `@repo/database` | Drizzle Studio GUI for the database |
| `pnpm seed` | `@repo/database` | Seed demo clinics (add `-- --reset` to wipe first) |

---

## Demo data

Seeding creates two independent clinics — different owners, different brands, different catalogs, zero shared rows.

| | Cairo Heart | Alexandria Pediatrics |
|---|---|---|
| Slug | `cairo-heart` | `alexandria-pediatrics` |
| Brand color | `#B91C1C` | `#2563EB` |
| Category · 1 | Heart Health | Fever & Pain |
| Category · 2 | Cholesterol | Nutrition |
| Category · 3 | Blood Pressure | Skin & Allergy |
| Category · 4 | Recovery & Heart Health | Sleep & Development |
| Products | 12 | 12 |
| Owner login | `cairo@demo.test` | `alex@demo.test` |
| Password | `Password123!` | `Password123!` |

---

## Deploying

The app is a single Next.js application and deploys to any Node hosting that can run Next.js (e.g. **Vercel**):

1. Push the repo to GitHub, then import it in Vercel — root directory `apps/web`, build command `pnpm --filter @repo/web build`.
2. Provision a managed PostgreSQL (e.g. **Neon**) and set a single environment variable:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
   ```
   Use the **pooled** connection string (PgBouncer) for the app runtime — `postgres.js` is configured with `prepare: false` for exactly this.
3. Point the local `DATABASE_URL` at the managed database and run `pnpm db:push` + `pnpm seed` once from your machine.
4. Deploy. Sessions are `secure` cookies automatically in production over HTTPS.

No other environment variables are required (`NEXT_PUBLIC_APP_URL` is unused in code).

---

## Roadmap

The short version of what's next:

- **Row-Level Security** — implement the third defense layer in the DB (`USING (tenant_id = current_setting('app.tenant_id')::uuid)`) so even an un-scoped query returns zero rows.
- **Unit/API test suite** — lint + typecheck instead of a full suite today.
- **Consumer features** — accounts and cart/checkout are out of scope by design for phase one.
- **Object storage uploads** — real image uploads to R2 (product rows already accept `https://` URLs).