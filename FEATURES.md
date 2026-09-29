# FEATURES.md — Multi-Tenant Telehealth Storefront

**Read `INSTRUCTIONS.md` first** — it defines the mandatory teaching loop.
**Read `ROADMAP.md`** for the phased build plan.

---

## 1. Mission

Build a **multi-tenant telehealth storefront demo** for two purposes:

1. **Learn** the concepts properly — monorepo architecture, multi-tenancy, tRPC, Drizzle,
   session auth, role-based authorization — from first principles, not by copying a tutorial.
2. **Showcase** it in a job interview as evidence of real hands-on experience.

Every line must be something the developer can explain from first principles.
"Working code" is not the goal. **Understandable code** is the goal.

---

## 2. Actors

The entire system has **two** actor types. This is a deliberate simplification: fewer roles
means one airtight authorization story instead of several half-demonstrated ones.

| Actor | Description | Account? | Can do |
|-------|-------------|----------|--------|
| **Clinic Owner** | The operator of one clinic tenant. Also its admin. | Yes | Everything inside their own tenant, and nothing outside it |
| **Consumer** | A person browsing a clinic's public site. | **No** | View storefront, shop, product detail, categories |

### The one rule the whole system exists to enforce

> **A Clinic Owner may only ever read or write data belonging to the tenant they own.**

Everything in this project — `memberships`, tRPC middleware, RLS, the route guards, the
cross-tenant tests — exists to make that sentence true and provable.

### Why consumers have no account

There is no cart and no purchase in this demo. Consumer accounts would have **nothing to
protect**: no orders, no saved data, no private content. Adding them would create a second
auth path with zero visible payoff. Public browsing keeps the security story focused on the
one thing that actually needs defending: **tenant isolation**.

---

## 3. The Clinic Owner's Journey

```
/                                   Public landing page
                                    ┌────────────────────────────┐
                                    │  [ Sign up ]   [ Sign in ] │
                                    └────────────────────────────┘
                                         │
              POST /api/auth/signup       │  clinic name, URL slug, email, password
                                         ▼
                        ┌──────────────────────────────────────┐
                        │  ONE TRANSACTION (atomic)            │
                        │   1. INSERT users                    │
                        │   2. INSERT tenants                  │
                        │   3. INSERT memberships              │
                        └──────────────────────────────────────┘
                                         │  slug collision?
                                         ▼  yes → friendly form error, nothing saved
                                   /{slug}/admin
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  ┌───────────────┐            ┌───────────────┐            ┌───────────────┐
  │  Storefront   │            │   Products    │            │  Categories   │
  │               │            │               │            │               │
  │ hero title    │            │ list + create │            │ create        │
  │ hero subtitle │            │ predefined    │            │ (parent of    │
  │ brand colors  │            │ schema form   │            │  products)    │
  │ block order   │            │               │            │               │
  │ enable/disable│            │               │            │               │
  └───────┬───────┘            └───────┬───────┘            └───────┬───────┘
          │ save                        │ create                     │ create
          ▼                             ▼                            ▼
  Public site updates            appears in that               appears on /shop
  immediately                    tenant's /shop only           as a filter
```

**Key insight being demonstrated:** the public site is *not* hand-built per clinic. It is
**generated** from configuration the owner controls. One codebase, infinite storefronts.

---

## 4. The Public Site Anatomy

Every tenant runs the **same** code at the **same** routes. The only difference is data.

| Route | Source of content | Tenant-configurable? |
|-------|-------------------|----------------------|
| `/{slug}` | `tenants.settings` JSON → component registry | ✅ blocks (text, order, visibility, colors) |
| `/{slug}/shop` | `products` table | ✅ automatically, from their catalog |
| `/{slug}/product/[slug]` | One `products` row | ✅ automatically |
| `/{slug}/category/[slug]` | Products where `category_id = ?` | ✅ automatically |

### What is fixed vs. configurable

| Element | Owner controls it? | Why |
|---------|--------------------|-----|
| Hero title / subtitle | ✅ Yes | Pure content — zero risk |
| Brand primary color | ✅ Yes | Pure presentation — zero risk |
| Block order, show/hide | ✅ Yes | Layout preference |
| CTA button label + destination | ❌ **Fixed** | Conversion-critical and product-critical. If every tenant could change it to "Buy Now →", the platform loses control of the checkout flow. This is a real product decision, not a limitation. |
| `/shop` layout, filters, pagination | ❌ **Fixed** | Built once by engineers. A self-built shop means 500 broken storefronts. |

> **The line to remember:** *content is configurable, commerce mechanics are not.*
> That's the entire philosophy behind a platform like this — and it's why Bask can
> onboard a clinic in minutes while the checkout flow stays safe and correct for all of them.

---

## 5. Feature Inventory

### 5.1 Consumer (no account)

| Feature | Why it exists |
|---------|---------------|
| Tenant storefront | Convert a visitor into an engaged user for *that specific clinic* |
| Branded theming | The clinic looks like its own business — the "your brand, our infrastructure" promise |
| Config-driven blocks | Owner changes their page with no developer and no deploy |
| Product catalog | The actual reason to visit |
| Category browsing | Self-serve discovery instead of "call us" |
| Product detail | Dosage, description, full attributes — enough to make a purchase decision |
| Filters + pagination | Catalogs grow. 12 per page is a performance and UX decision, not a feature. |

### 5.2 Clinic Owner (authenticated)

| Feature | Why it exists |
|---------|---------------|
| Self-serve signup | A new clinic becomes a live product in minutes. This is the company's revenue motion. |
| Atomic signup transaction | A partial signup (user created, tenant failed) is a data-integrity bug. All-or-nothing. |
| Session auth | Identity that can be revoked instantly. |
| Tenant-scoped authorization | The core security guarantee of the entire platform. |
| Block editor | Owners won't wait on an engineering ticket to fix a typo in their hero. |
| Category management | Products need structure or a catalog is an undifferentiated list. |
| Product predefined schema | Guarantees data quality across every tenant. A supplement with no dosage or category is not sellable. |
| Custom product attributes | Flexibility without a deploy. A clinic selling skincare needs ingredients; one selling devices needs warranty. |
| Image URL field | Demo shortcut for real file upload. |
| Slug collision error UX | A raw Postgres error is unacceptable in a product. Constraints catch it; the form must explain it. |

---

## 6. Data Model

```
   tenants ──────┬──────< categories ──────< products
      │           │
      │           └──────< memberships >────── users ──────< sessions
      │
      └── settings (jsonb): brand colors, hero copy, block order + enabled flags
```

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `tenants` | One row per clinic | `slug` (unique), `name`, `settings` (jsonb) |
| `users` | Humans — clinic owners | `email` (unique), `passwordHash` |
| `sessions` | Server-side sessions | `id` (opaque random hex PK), `userId`, `expiresAt` |
| `memberships` | **Many-to-many users ↔ tenants** | PK `(userId, tenantId)`, `role` |
| `categories` | Product grouping, owned by a tenant | `tenantId` FK, `slug`, `name`, unique `(tenantId, slug)` |
| `products` | The catalog | `tenantId` FK, `categoryId` FK, `slug`, `priceCents`, `attrs` (jsonb) |

### Why `memberships` is the most important table

A user is **not** a tenant. A consultant might own two clinics. `memberships` is how the
system answers the only question that matters: *"is this person a member of **this** tenant?"*
The `hasRole` middleware runs this lookup on every authenticated request.

### Why `categories` is a table, not a text field on products

A text field would make "show me all products in 'Vitamins'" an unindexed string comparison,
and would let a product point at a category belonging to a **different tenant** — a real
data-isolation bug. A foreign key makes that structurally impossible. **This is the single
most instructive schema decision in the project.**

### Indexes derive from queries, not habit

| Index | The exact query it serves |
|-------|--------------------------|
| `tenants.slug` unique | Resolving `/{tenantSlug}` on every single request |
| `products` unique `(tenant_id, slug)` | Product detail page. Uniqueness is **per tenant** — two clinics may both sell "vitamin-d" |
| `products` index `(tenant_id, category_id)` | `/shop` filters + `/category/[slug]` |
| `categories` unique `(tenant_id, slug)` | Category page URL. Per-tenant uniqueness. |
| `memberships` PK `(user_id, tenant_id)` | The `hasRole` authorization check — once per authenticated request |
| `sessions` index `(user_id)` | Revoke all of a user's sessions |

---

## 7. Three Independent Defense Layers

| # | Layer | Mechanism | What it protects against |
|---|-------|-----------|------------------------|
| 1 | **UI** | `requireRole()` in `admin/layout.tsx` | Confusing UX. An owner who isn't authorized shouldn't see the form. |
| 2 | **API** | `hasRole` tRPC middleware | **This is the actual authorization.** A curl request cannot bypass it. |
| 3 | **Data** | PostgreSQL Row-Level Security | A developer forgetting a `where tenant_id = ?` in a query. RLS returns zero rows anyway. |

**The interview line:**

> "A logged-in owner of Cairo Heart hitting `/alexandria-pediatrics/admin` gets redirected by
> the layout. Calling the tRPC endpoint directly without a membership gets `403 FORBIDDEN` from
> `hasRole`. And if a query ever forgot its `tenant_id` filter, Postgres RLS returns zero rows
> regardless. Any one of these alone is bypassable — that's why there are three."

---

## 8. Developer Gains

What this project earns you in the interview. Each row is a talking point.

| Skill | Demonstrated by | Interview value |
|-------|-----------------|-----------------|
| **Multi-tenant architecture** | `tenant_id` scoping, per-tenant uniqueness, RLS | The core thing they asked about |
| **Transactional integrity** | Atomic signup: user + tenant + membership | Real-world failure-mode thinking |
| **AuthN** | Opaque session cookies, revocability | Every security conversation starts here |
| **AuthZ** | Composable tRPC middleware chain | The question that separates mid from senior |
| **Schema design** | Composite unique keys, FK strategy, index-from-query | SQL depth — explicitly in their JD |
| **Error handling** | `TRPCError` taxonomy, slug-collision UX, loading/empty/error states | "Clear, helpful error messages" — in their JD |
| **tRPC** | Type-safe procedures, Zod boundaries | Their exact stack |
| **Drizzle** | Typed `jsonb`, relations, migrations | Their exact stack |
| **Monorepo architecture** | One-way dependencies, workspace protocol | How real companies are organized |
| **Next.js App Router** | Server/Client split, layouts, nested dynamic routes | Most common modern React role |
| **Config-driven UI** | Component registry, JSON blocks, CSS variables | Maps **directly** to their actual product |
| **Testing** | Cross-tenant denial tests | "We have a real test suite and intend to keep it" — their words |
| **Performance** | Server Components, no N+1, selective hydration | "Champion performance" — in their JD |

**Resume bullet to earn:**

> Built a multi-tenant telehealth storefront on a pnpm workspaces monorepo — Next.js 16, tRPC,
> Drizzle, PostgreSQL — with per-tenant data isolation enforced at three independent layers
> (route guard → tRPC role middleware → Postgres RLS), DB-backed session auth, and
> config-driven white-label UI rendered from a typed JSON block registry.

---

## 9. Out of Scope (and how to say so)

| Not built | Why | What it would need |
|-----------|-----|--------------------|
| Cart / checkout / payments | Payments is weeks, not hours | Stripe, webhook idempotency, tax, PCI concerns |
| Consumer accounts | Nothing to protect without purchases | — |
| Appointments / scheduling | A separate bounded context | Calendar conflict logic, reminders |
| Video visits | Their actual core product | WebRTC, TURN infrastructure |
| Prescriptions / EMR | Regulated clinical workflows | HIPAA audit logging, pharmacy integration |
| Billing / subscriptions | The platform's own revenue model | Stripe Billing, plan enforcement |
| Real file/image uploads | Storage infrastructure | S3, signed URLs, virus scanning, CDN |
| Drag-and-drop page builder | Weeks of work; low teaching value | dnd-kit, canvas, undo/redo, versioning |
| Search | Separate problem | Postgres full-text search or Algolia |
| Email verification / password reset | Not part of the isolation story | Email provider, token lifecycle |
| i18n / full a11y audit | Breadth over depth | — |

**The framing sentence for the interview:**

> "I deliberately scoped this to prove the hard architecture — tenant isolation, atomic
> provisioning, role-based auth, and config-driven white-label rendering — rather than breadth.
> A working vertical slice of the difficult parts is worth more than a shallow version of
> everything. I can tell you exactly how I'd add payments, and where the failure modes are."

That reads as **judgment**, which is precisely what a startup screens for.

---

## 10. Feature → Roadmap Task Map

| Feature group | Roadmap tasks |
|---------------|---------------|
| Self-serve signup (atomic) | 3.8, 4.3 |
| Sign in / sign out | 4.4, 4.5 |
| Session auth internals | 4.1, 4.2 |
| Role-based authorization | 4.6, 4.7, 6.1 |
| Tenant resolution & theming | 5.1, 5.2 |
| Component registry | 5.3 |
| Storefront blocks | 5.4 |
| Auto-built shop page | 5.6 |
| Product detail page | 5.7 |
| Category page | 5.8 |
| Block editor (Storefront tab) | 6.5 |
| Category management | 6.6 |
| Product predefined schema | 6.2, 6.3, 6.4 |
| Data isolation (3 layers) | 2.2, 2.7, 4.7, 6.7, 7.1 |
| Proof & polish | 7.1 – 7.4 |

---

## 11. Project Files

| File | Purpose |
|------|---------|
| `INSTRUCTIONS.md` | The teaching protocol. Read first, always. |
| `ROADMAP.md` | The phased build plan. |
| `FEATURES.md` | This file — scope, actors, data model, and what we deliberately skip. |
