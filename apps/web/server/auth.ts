import crypto from "node:crypto";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import {
  db,
  sessions,
  users,
} from "@repo/database";

const SESSION_DURATION_MS =
  1000 * 60 * 60 * 24 * 30;

export async function createSession(userId: string) {
  const sessionId = crypto
    .randomBytes(32)
    .toString("hex");

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_MS,
  );

  const [session] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      userId,
      expiresAt,
    })
    .returning();

  return session;
}

export async function getUserFromRequest() {
  const cookieStore = await cookies();

  const sessionId =
    cookieStore.get("session")?.value;

  if (!sessionId) {
    return null;
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await db
      .delete(sessions)
      .where(eq(sessions.id, sessionId));

    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    session,
    user,
  };
}

export async function destroySession(
  sessionId: string,
) {
  await db
    .delete(sessions)
    .where(eq(sessions.id, sessionId));
}

export const SESSION_COOKIE_NAME = "session";

export const SESSION_DURATION =
  SESSION_DURATION_MS;