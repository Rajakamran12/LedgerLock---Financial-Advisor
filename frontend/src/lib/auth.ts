import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {}

/**
 * Resolves the authenticated user for the current request, always via
 * `getUser()` (never trusting a decoded session cookie) so every route
 * re-validates against Supabase Auth.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError("Not authenticated");
  }

  return { supabase, user };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function rateLimitedResponse() {
  return NextResponse.json(
    { error: "Rate limit exceeded. Please slow down." },
    { status: 429 }
  );
}

export function notFoundResponse(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
