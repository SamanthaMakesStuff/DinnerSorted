/**
 * Session lookup used by the app shell.
 * P0: accounts don't exist yet, so everyone is a guest and accounts are
 * reported unavailable. Replaced with a real Auth.js lookup in P1 — keeping
 * the call-sites stable either way.
 */
export interface SessionUser {
  id: string;
  email: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return null;
}

/** Whether the accounts system is available on this deployment. */
export function accountsEnabled(): boolean {
  return false;
}
