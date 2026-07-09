import { NextResponse } from "next/server";

/**
 * Defence-in-depth CSRF check for state-changing JSON API routes: if an
 * Origin header is present it must match the request host. (Auth.js routes
 * carry their own CSRF protection; session cookies are SameSite=Lax.)
 */
export function sameOriginOk(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit it
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
