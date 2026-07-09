import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { accountsEnabled, getSessionUser } from "@/lib/session";
import { jsonError, sameOriginOk } from "@/lib/api-util";

/**
 * Delete the account and every piece of stored data (user_data cascades).
 * The UI walks the user through exporting first — "export everything, then
 * delete" per the spec.
 */
export async function DELETE(request: Request) {
  if (!accountsEnabled()) return jsonError("Accounts aren't available.", 503);
  if (!sameOriginOk(request)) return jsonError("Request blocked.", 403);
  const user = await getSessionUser();
  if (!user) return jsonError("You need to be signed in.", 401);

  const db = getDb();
  await db.delete(users).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
