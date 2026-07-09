/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Email + password with bcrypt hashing, per the spec's 5a. Sessions are JWT
 * (required for the Credentials provider) with an optional "stay signed in"
 * long session — re-authenticating repeatedly is a real friction point for
 * this audience, so long sessions are a first-class choice, not a dark
 * pattern.
 *
 * Login attempts are rate-limited durably in the database (5 failures locks
 * the account for 15 minutes) so the limit holds across serverless
 * instances. CSRF protection and secure cookies come from Auth.js itself.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { dbConfigured, getDb } from "./db";
import { users } from "./db/schema";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const SHORT_SESSION_MS = 24 * 60 * 60 * 1000; // 1 day unless "stay signed in"
const LONG_SESSION_DAYS = 60;

// Hash compared for unknown emails so response timing doesn't reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // A secret is always required by Auth.js; when accounts are disabled the
  // auth routes are never used, so the fallback never protects real data.
  secret:
    process.env.AUTH_SECRET ?? "accounts-disabled-placeholder-secret",
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: LONG_SESSION_DAYS * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Stay signed in", type: "text" },
      },
      async authorize(credentials) {
        if (!dbConfigured()) return null;
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          // Locked out — treat like a failed login without incrementing.
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await db
            .update(users)
            .set(
              failed >= MAX_FAILED_LOGINS
                ? {
                    failedLogins: 0,
                    lockedUntil: new Date(
                      Date.now() + LOCKOUT_MINUTES * 60 * 1000
                    ),
                  }
                : { failedLogins: failed }
            )
            .where(eq(users.id, user.id));
          return null;
        }

        if (user.failedLogins > 0 || user.lockedUntil) {
          await db
            .update(users)
            .set({ failedLogins: 0, lockedUntil: null })
            .where(eq(users.id, user.id));
        }

        return {
          id: user.id,
          email: user.email,
          remember: String(credentials?.remember) === "true",
        } as { id: string; email: string; remember: boolean };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; email: string; remember?: boolean };
        token.sub = u.id;
        token.email = u.email;
        token.remember = u.remember === true;
        token.shortExpiry = Date.now() + SHORT_SESSION_MS;
      }
      // Without "stay signed in", the session ends after a day even though
      // the cookie could live longer.
      if (
        token.remember !== true &&
        typeof token.shortExpiry === "number" &&
        Date.now() > token.shortExpiry
      ) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
