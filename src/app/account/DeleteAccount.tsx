"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useStore } from "@/lib/store";

/**
 * "Export everything, then delete" flow. Deletion requires ticking an
 * explicit confirmation — no timed steps, no re-typing challenges.
 */
export function DeleteAccount() {
  const router = useRouter();
  const { data } = useStore();
  const confirmId = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dinnersorted-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Deleting didn't work — please try again.");
        setBusy(false);
        return;
      }
      await signOut({ redirect: false });
      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — nothing was deleted.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delete-heading">
      <h2 id="delete-heading">Delete this account</h2>
      <p>
        This permanently removes your account and everything stored with it —
        preferences, safe meals, history, all of it. It can&rsquo;t be undone.
      </p>
      <ol>
        <li>
          <button type="button" className="secondary small" onClick={exportData}>
            Download everything first (recommended)
          </button>
        </li>
        <li>
          <div className="check-row">
            <input
              id={confirmId}
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <label htmlFor={confirmId}>
              I understand this deletes my account and all stored data
            </label>
          </div>
        </li>
        <li>
          <button
            type="button"
            className="danger"
            disabled={!confirmed || busy}
            onClick={deleteAccount}
          >
            {busy ? "Deleting…" : "Delete my account and data"}
          </button>
        </li>
      </ol>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
