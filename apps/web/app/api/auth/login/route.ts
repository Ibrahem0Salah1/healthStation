import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

import {
  db,
  memberships,
  tenants,
  users,
} from "@repo/database";

import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION,
} from "@/server/auth";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .toLowerCase(),

  password: z
    .string()
    .min(1)
    .max(128),
});

/**
 * A real bcrypt hash of a throwaway string, computed ONCE at module load.
 *
 * WHY THIS EXISTS — timing-based user enumeration.
 *
 * A 12-round bcrypt compare takes roughly 200-300ms because bcrypt is
 * deliberately slow. A simple indexed lookup by email takes about 1-2ms.
 *
 * If we returned early for an unknown email, the two cases would be trivially
 * distinguishable by response time alone:
 *
 *   known email, wrong password   -> ~250ms  (bcrypt ran)
 *   unknown email                -> ~2ms    (returned immediately)
 *
 * An attacker scripts a few hundred requests, measures, and walks a list of
 * addresses to find out exactly which ones have accounts on your site. The
 * error MESSAGE being identical does not help — the side channel is time, not
 * text.
 *
 * The fix: always run bcrypt, even when the user does not exist. Comparing
 * against this dummy hash does the same expensive work and produces the same
 * response shape, so the two paths take the same time.
 *
 * (Same defence-in-depth idea as constant-time comparison elsewhere: if an
 * attacker can observe how long your check took, the check itself leaks.)
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "this-is-not-a-real-password",
  12,
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // `body` holds the plaintext password — never logged.

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Invalid email or password.",
        },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always spend the bcrypt time, whether or not the account exists.
    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    // One condition, one response. The caller cannot tell these apart.
    if (!user || !passwordMatches) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    const session = await createSession(user.id);

    /**
     * The clinics this user belongs to.
     *
     * Without this the client has no idea where to send the user after
     * login — and the obvious workarounds are both bad: bouncing everyone to
     * a single hardcoded clinic, or adding a "which clinic do you mean?"
     * screen. Returning the membership list makes `FEATURES.md`'s "a user is
     * NOT a tenant" model visible in the API.
     *
     * Derived from `user.id` (server-side), never from the request body.
     */
    const tenantList = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
      })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(eq(memberships.userId, user.id))
      .orderBy(asc(tenants.name));

    const response = NextResponse.json(
      {
        status: "success",
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          tenants: tenantList,
        },
      },
      { status: 200 },
    );

    // httpOnly -> JS cannot read it (XSS cannot steal it)
    // secure   -> HTTPS only in production
    // sameSite -> 'lax' blocks cross-site POSTs, which is CSRF defence
    // path     -> sent to every route, because /admin needs it too
    // The value is the OPAQUE RANDOM SESSION ID ONLY — never a role, never a
    // user id, never a JWT payload. The server looks it up; it is not a claim.
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
    // Detail goes to the server log; the client gets a fixed string.
    // Returning error.message would hand a client SQL fragments, table names,
    // and potentially connection details on any database failure.
    console.error("Login error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Something went wrong.",
      },
      { status: 500 },
    );
  }
}
