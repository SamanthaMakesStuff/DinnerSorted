/**
 * Session lookup used by the app shell and API routes.
 * Accounts are available only when both DATABASE_URL and AUTH_SECRET are
 * configured; otherwise the app runs happily in guest (export/import) mode.
 */
import { auth } from "./auth";

export interface SessionUser {
  id: string;
  email: string;
}

export function accountsEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!accountsEnabled()) return null;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return { id: session.user.id, email: session.user.email };
}
