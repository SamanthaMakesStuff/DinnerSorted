"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { parseImportedJson } from "@/lib/schema";

export default function DataPage() {
  const { data, replaceData, ready, signedIn } = useStore();
  const [importError, setImportError] = useState("");
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `dinnersorted-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Backup downloaded. Keep it somewhere safe — it contains everything.");
  }

  async function onFileChosen(file: File | undefined) {
    setImportError("");
    setStatus("");
    if (!file) return;
    const text = await file.text();
    const result = parseImportedJson(text);
    if (!result.ok || !result.data) {
      setImportError(result.error ?? "That file couldn't be read.");
      return;
    }
    replaceData(result.data);
    setStatus(
      `Data restored: ${result.data.safeMeals.length} safe meal${
        result.data.safeMeals.length === 1 ? "" : "s"
      }, ${result.data.planHistory.length} saved week${
        result.data.planHistory.length === 1 ? "" : "s"
      }, and all preferences.`
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <h1>Data &amp; backup</h1>
      <p className="lede">
        Everything DinnerSorted knows about you fits in one file that you own.
      </p>

      {!signedIn && (
        <p className="notice info">
          You&rsquo;re using DinnerSorted without an account, so your data
          lives <strong>only in this browser tab</strong> and is gone when the
          tab closes. Downloading a backup below is how you keep it. Because
          allergy details are health-related, nothing is stored on this device
          beyond the current session.
        </p>
      )}

      <section aria-labelledby="export-heading">
        <h2 id="export-heading">Download my data</h2>
        <p>
          One JSON file containing your preferences, safe meals, plan history
          and freezer stock. Use it to move devices, restore after closing the
          tab, or just keep a copy.
        </p>
        <button type="button" onClick={download}>
          Download my data
        </button>
      </section>

      <hr />

      <section aria-labelledby="import-heading">
        <h2 id="import-heading">Upload my data</h2>
        <p>
          Restore from a previously downloaded file.{" "}
          <strong>This replaces what&rsquo;s currently loaded.</strong> If
          you&rsquo;re not sure, download a backup of the current data first.
        </p>
        <div className="field">
          <label htmlFor="import-file">Choose your DinnerSorted backup file</label>
          <input
            ref={fileRef}
            id="import-file"
            type="file"
            accept="application/json,.json"
            aria-describedby={importError ? "import-error" : undefined}
            aria-invalid={importError ? true : undefined}
            onChange={(e) => onFileChosen(e.target.files?.[0])}
          />
          {importError && (
            <p className="error-text" id="import-error" role="alert">
              {importError}
            </p>
          )}
        </div>
      </section>

      <p aria-live="polite" role="status" className={status ? "notice info" : "visually-hidden"}>
        {status}
      </p>

      <hr />

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">What&rsquo;s stored, and why</h2>
        <ul>
          <li>
            <strong>Preferences</strong> (allergies, sensory needs, energy,
            budget, shopping) — used only to filter and plan your meals.
          </li>
          <li>
            <strong>Safe meals and plan history</strong> — used to generate
            weekly menus and shopping lists.
          </li>
          <li>
            <strong>Medication/appetite details</strong> — entirely optional;
            used only to time suggestions and reminders. Leave blank freely.
          </li>
        </ul>
        <p>
          No analytics, no tracking, no diet-culture metrics. Guest data is
          never written to disk on a server; account data (when signed in) is
          stored in a managed Postgres database, encrypted at rest, and can be
          exported or deleted at any time.
        </p>
      </section>
    </>
  );
}
