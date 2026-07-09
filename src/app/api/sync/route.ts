import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userData } from "@/lib/db/schema";
import { accountsEnabled, getSessionUser } from "@/lib/session";
import { userDataSchema } from "@/lib/schema";
import { jsonError, sameOriginOk } from "@/lib/api-util";

// Generous but bounded — the whole document for a heavy user is well under this.
const MAX_BYTES = 1_000_000;

export async function GET() {
  if (!accountsEnabled()) return jsonError("Accounts aren't available.", 503);
  const user = await getSessionUser();
  if (!user) return jsonError("You need to be signed in.", 401);

  const db = getDb();
  const [row] = await db
    .select({ data: userData.data })
    .from(userData)
    .where(eq(userData.userId, user.id))
    .limit(1);

  return NextResponse.json({ data: row?.data ?? null });
}

export async function PUT(request: Request) {
  if (!accountsEnabled()) return jsonError("Accounts aren't available.", 503);
  if (!sameOriginOk(request)) return jsonError("Request blocked.", 403);
  const user = await getSessionUser();
  if (!user) return jsonError("You need to be signed in.", 401);

  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return jsonError("That's too much data to save.", 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError("Invalid request.", 400);
  }
  const parsed = userDataSchema.safeParse(
    (body as { data?: unknown })?.data
  );
  if (!parsed.success) {
    return jsonError("That data isn't in DinnerSorted's format.", 400);
  }

  const db = getDb();
  await db
    .insert(userData)
    .values({ userId: user.id, data: parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userData.userId,
      set: { data: parsed.data, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
