"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const ids = { email: useId(), password: useId(), remember: useId() };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please fill in both your email and your password.");
      return;
    }
    setBusy(true);
    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      remember: String(remember),
      redirect: false,
    });
    setBusy(false);
    if (result?.error) {
      setError(
        "That email and password don't match an account. After several failed tries, sign-in is paused for 15 minutes to protect the account."
      );
      return;
    }
    router.push("/");
    router.refresh();
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
          aria-describedby={error ? "login-error" : undefined}
          aria-invalid={error ? true : undefined}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={ids.password}>Password</label>
        <input
          id={ids.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? "login-error" : undefined}
          aria-invalid={error ? true : undefined}
          required
        />
      </div>
      <div className="check-row">
        <input
          id={ids.remember}
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <label htmlFor={ids.remember}>
          Stay signed in on this device
          <span className="label-hint">
            Recommended — no re-typing passwords every visit. Untick on a
            shared computer.
          </span>
        </label>
      </div>
      {error && (
        <p className="error-text" id="login-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
