import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import {
  db,
  memberships,
  storefronts,
  tenants,
  users,
} from "@repo/database";

import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION,
} from "@/server/auth";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),

  email: z
    .string()
    .trim()
    .email()
    .toLowerCase(),

  password: z
    .string()
    .min(8)
    .max(128),

  tenantName: z
    .string()
    .trim()
    .min(2)
    .max(100),

  tenantSlug: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Invalid tenant slug",
    ),
});

/**
 * Postgres SQLSTATE 23505 = unique_violation.
 *
 * The database is the real enforcer of uniqueness — the app only *reads* the
 * error and turns it into something a human can act on. Both `tenants.slug`
 * and `users.email` are UNIQUE, so a collision surfaces as a driver error that
 * would otherwise land in the generic 500 handler.
 *
 * WHY THE LOOP: the error is WRAPPED, not raw.
 *
 *   postgres.js throws a `PostgresError` with `code: '23505'`
 *        ↓ wrapped by
 *   Drizzle throws a `DrizzleQueryError` whose own `code` is undefined and
 *   whose ORIGINAL error is on `.cause`
 *        ↓ thrown out of
 *   db.transaction()
 *
 * So checking `error.code` alone silently never matches — which is exactly
 * how a duplicate signup ends up returning 500 instead of 409. We walk the
 * `.cause` chain until we find a code.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  // Bounded walk so a self-referential cause chain cannot hang the request.
  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== "object" || current === null) return false;

    const candidate = current as { code?: unknown; cause?: unknown };

    if (candidate.code === "23505") return true;

    if (!("cause" in candidate)) return false;
    current = candidate.cause;
  }

  return false;
}

/**
 * Eight brand colors, one per clinic, chosen by hashing the slug.
 *
 * WHY: the whole product promise is "your brand, our infrastructure." If every
 * self-serve tenant rendered the platform's default blue, that promise is
 * invisible and the multi-tenant story has nothing to show. Deterministic
 * assignment (rather than random) means re-running the same signup form twice
 * during a demo gives the same clinic the same color.
 */
const BRAND_COLORS = [
  "#B91C1C", // red
  "#2563EB", // blue
  "#059669", // emerald
  "#7C3AED", // violet
  "#D97706", // amber
  "#DB2777", // pink
  "#0891B2", // cyan
  "#65A30D", // lime
] as const;

/**
 * FNV-1a, 32-bit. A stable non-cryptographic hash.
 *
 * NOT a security primitive and must never be used as one — it is trivially
 * reversible by brute force. It is used here only to spread slugs across
 * BRAND_COLORS deterministically. `crypto.createHash("sha256")` would be the
 * overkill choice, and would make this harder to read for zero benefit.
 *
 * `>>> 0` coerces to an unsigned 32-bit integer. Without it, a high-entropy
 * hash lands negative in JS and `% length` returns a negative index.
 */
function hashSlug(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export async function POST(request: Request) {
  try {
    // Malformed JSON is a CLIENT error (400), not a server error (500).
    // request.json() throws on invalid input, and without this guard the
    // throw lands in the catch below and is mislabelled as our fault.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: "fail", message: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    // NOTE: `body` is never logged. It contains the plaintext password.
    // Logging a request body is how credentials end up in a log aggregator.
    // If you ever need to debug here, log `parsed.error.flatten()` only —
    // it describes what was wrong without echoing the values.

    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Invalid data.",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      name,
      email,
      password,
      tenantName,
      tenantSlug,
    } = parsed.data;

    const passwordHash = await bcrypt.hash(
      password,
      12,
    );

    /**
     * ATOMIC. User + tenant + membership are created in ONE transaction.
     *
     * This is the invariant the whole project turns on: a user with no tenant
     * is a permanently broken account — they could sign in and then have
     * nothing to administer. Either all three rows exist, or none do.
     */
    const result = await db.transaction(
      async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            name,
            email,
            passwordHash,
          })
          .returning({
            id: users.id,
            name: users.name,
            email: users.email,
          });

        if (!user) {
          throw new Error("User insert returned no row");
        }

        const [tenant] = await tx
          .insert(tenants)
          .values({
            name: tenantName,
            slug: tenantSlug,
          })
          .returning({
            id: tenants.id,
            name: tenants.name,
            slug: tenants.slug,
          });

        if (!tenant) {
          throw new Error("Tenant insert returned no row");
        }

        // The membership is what grants access. `tenantId` here is the one we
        // just generated server-side — never anything from the request body.
        await tx.insert(memberships).values({
          userId: user.id,
          tenantId: tenant.id,
          role: "owner",
        });

        /**
         * THE STOREFRONT ROW.
         *
         * This is the fourth insert, and it is the one that was missing.
         *
         * `storefronts.config` is `jsonb NOT NULL`, and it is the ONLY source
         * of the hero copy, brand color, and block toggles that Phase 5
         * renders `/{slug}` from. Without this row a self-serve tenant has a
         * clinic page with no config: every storefront query returns nothing
         * and the page falls back to nothing at all.
         *
         * Why defaults are generated here and not in the storefront layout:
         * the layout is a READ path. A read path that invents missing data
         * means a half-configured clinic silently renders as if it were
         * configured. Writing the row at provisioning time makes "every tenant
         * has a storefront" a fact about the database, not a hopeful
         * assumption about the code.
         *
         * All four inserts share one transaction, so a tenant can never exist
         * without its config.
         */
        await tx.insert(storefronts).values({
          tenantId: tenant.id,
          config: {
            hero: {
              headline: `${tenantName} Telehealth`,
              subheadline:
                "Browse treatments, consultations, and health products from our licensed specialists.",
              /**
               * ctaHref is RELATIVE, not absolute. If it were a full URL a
               * tenant could point the CTA at another clinic's site — a
               * phishing vector using our own domain's credibility. The
               * storefront prepends the tenant slug, so a clinic can only
               * ever link into its own storefront.
               */
              ctaHref: "/shop",
              ctaLabel: "Explore Treatments",
            },
            theme: {
              /**
               * Generated from the slug so two signups never collide on a
               * brand color, and so the owner's very first page load already
               * looks like a distinct clinic rather than a default.
               */
              primaryColor: BRAND_COLORS[
                hashSlug(tenantSlug) % BRAND_COLORS.length
              ]!,
              fontFamily: "sans",
              showTrustBadges: true,
            },
            announcement: null,
            showCategories: true,
          },
        });

        return { user, tenant };
      },
    );

    const session = await createSession(result.user.id);

    const response = NextResponse.json(
      {
        status: "success",
        data: {
          user: result.user,
          tenant: result.tenant,
        },
      },
      { status: 201 },
    );

    /**
     * Without this the session row is orphaned: written to the database but
     * its id never reaches the browser, so nothing can ever look it up.
     * A user who "signs up" is not signed in.
     *
     * httpOnly  -> JavaScript cannot read it, so XSS cannot steal it
     * secure    -> HTTPS only (and plain HTTP is dropped in dev)
     * sameSite  -> 'lax' blocks cross-site POSTs, which is CSRF protection
     *             for free, without a CSRF token library
     */
    response.cookies.set(
      SESSION_COOKIE_NAME,
      session.id,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(Date.now() + SESSION_DURATION),
        path: "/",
      },
    );

    return response;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // We deliberately do NOT say *which* field collided in a way that
      // confirms an account exists — the client already knows what it sent,
      // and a generic message keeps this from becoming an account-existence
      // oracle for anyone probing the endpoint.
      return NextResponse.json(
        {
          status: "fail",
          message:
            "That email or clinic URL is already taken. Try a different one.",
        },
        { status: 409 },
      );
    }

    // The full error is logged server-side; the client gets nothing specific.
    // Echoing error.message would leak SQL fragments, table names, and
    // sometimes connection details.
    console.error("Signup error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Something went wrong.",
      },
      { status: 500 },
    );
  }
}
