"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function RegisterForm() {
  const router = useRouter();
  const ids = { email: useId(), password: useId(), confirm: useId() };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 10) {
      setError(
        "Password needs to be at least 10 characters. A few random words work well and are easier to remember."
      );
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match — check for typos.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong — please try again.");
        setBusy(false);
        return;
      }
      // Sign straight in; the store pushes any guest-session data to the
      // account on first load.
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        remember: "true",
        redirect: false,
      });
      setBusy(false);
      if (result?.error) {
        setError("Account created, but sign-in failed. Try signing in from the Sign in page.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setBusy(false);
      setError("Couldn't reach the server — check your connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: "28rem" }}>
      <div className="field">
        <label htmlFor={ids.email}>Email</label>
        <input
          id={ids.email}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? "register-error" : undefined}
          aria-invalid={error ? true : undefined}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={ids.password}>
          Password
          <span className="label-hint">
            At least 10 characters. A few random words are easier to remember
            than symbols.
          </span>
        </label>
        <input
          id={ids.password}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? "register-error" : undefined}
          aria-invalid={error ? true : undefined}
          required
          minLength={10}
        />
      </div>
      <div className="field">
        <label htmlFor={ids.confirm}>Type the password again</label>
        <input
          id={ids.confirm}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-describedby={error ? "register-error" : undefined}
          aria-invalid={error ? true : undefined}
          required
        />
      </div>
      {error && (
        <p className="error-text" id="register-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </div>
    </form>
  );
}
