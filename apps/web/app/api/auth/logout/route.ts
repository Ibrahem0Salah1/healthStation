import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  destroySession,
  SESSION_COOKIE_NAME,
} from "@/server/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();

    const sessionId =
      cookieStore.get(
        SESSION_COOKIE_NAME,
      )?.value;

    if (sessionId) {
      await destroySession(sessionId);
    }

    const response =
      NextResponse.json({
        status: "success",
      });

    response.cookies.delete(
      SESSION_COOKIE_NAME,
    );

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Something went wrong.",
      },
      { status: 500 },
    );
  }
}