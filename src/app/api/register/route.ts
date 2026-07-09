import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { accountsEnabled } from "@/lib/session";
import { jsonError, sameOriginOk } from "@/lib/api-util";
import { makeId } from "@/lib/defaults";

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like an email address."),
  password: z
    .string()
    .min(10, "Password needs to be at least 10 characters. A few random words work well."),
});

export async function POST(request: Request) {
  if (!accountsEnabled()) {
    return jsonError("Accounts aren't available on this deployment.", 503);
  }
  if (!sameOriginOk(request)) return jsonError("Request blocked.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request.", 400);
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0].message, 400);
  }

  const { email, password } = parsed.data;
  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return jsonError(
      "There's already an account with that email. Try signing in instead.",
      409
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ id: makeId("user"), email, passwordHash });

  return NextResponse.json({ ok: true });
}
