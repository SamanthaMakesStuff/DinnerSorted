"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { parseReceiptText, type RemovedItem } from "@/lib/receipt";
import { extractTextFromImage, extractTextFromPdf } from "@/lib/extract";
import { makeId } from "@/lib/defaults";
import type { SafeMeal } from "@/lib/types";

type Phase = "input" | "reading" | "choose";

export default function ReceiptImportPage() {
  const { data, update, ready } = useStore();
  const pasteId = useId();
  const fileId = useId();
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pasted, setPasted] = useState("");
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [removed, setRemoved] = useState<RemovedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(0);

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  const existingNames = new Set(data.safeMeals.map((m) => m.name.toLowerCase()));

  function showResults(text: string, sourceLabel: string) {
    const result = parseReceiptText(text);
    if (result.food.length === 0 && result.removed.length === 0) {
      setPhase("input");
      setError(
        `No items could be read from that ${sourceLabel}. If it was a photo, try a clearer, straight-on screenshot with good lighting.`
      );
      return;
    }
    setCandidates(result.food);
    setRemoved(result.removed);
    setSelected(new Set());
    setAdded(0);
    setError("");
    setPhase("choose");
    setStatus(
      `Found ${result.food.length} item${result.food.length === 1 ? "" : "s"}` +
        (result.removed.length > 0
          ? `, and set aside ${result.removed.length} that ${
              result.removed.length === 1 ? "doesn't" : "don't"
            } look like food.`
          : ".")
    );
    setTimeout(() => resultsRef.current?.focus(), 0);
  }

  function readPasted() {
    if (!pasted.trim()) {
      setError("Paste your receipt text into the box first.");
      return;
    }
    showResults(pasted, "pasted text");
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        setPhase("reading");
        setStatus("Reading your PDF…");
        const text = await extractTextFromPdf(file);
        if (!text || text.length < 20) {
          setPhase("input");
          setError(
            "That PDF doesn't contain readable text (it may be a scan). Take a screenshot of it and upload that as an image instead."
          );
          return;
        }
        showResults(text, "PDF");
      } else if (file.type.startsWith("image/")) {
        setPhase("reading");
        setProgress(0);
        setStatus(
          "Reading your screenshot… this can take up to half a minute the first time."
        );
        const text = await extractTextFromImage(file, (f) =>
          setProgress(Math.round(f * 100))
        );
        showResults(text, "screenshot");
      } else {
        setError(
          "That file type isn't supported — use a screenshot (PNG/JPG), a PDF, or paste the text."
        );
      }
    } catch {
      setPhase("input");
      setError(
        "Something went wrong reading that file. Pasting the receipt text usually works best."
      );
    }
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function rescue(item: RemovedItem) {
    setRemoved((prev) => prev.filter((r) => r.name !== item.name));
    setCandidates((prev) => [...prev, item.name]);
    setSelected((prev) => new Set(prev).add(item.name));
  }

  function addSelected() {
    const names = candidates.filter(
      (c) => selected.has(c) && !existingNames.has(c.toLowerCase())
    );
    if (names.length === 0) {
      setError("Tick at least one item first.");
      return;
    }
    const newMeals: SafeMeal[] = names.map((name) => ({
      id: makeId("meal"),
      name,
      notes: "Added from a receipt",
      effort: "low",
      steps: null,
      pans: null,
      equipment: [],
      temperature: "any",
      tags: [],
      ingredients: [],
      estCost: null,
      allergens: [],
      traceAllergens: [],
      isNew: false,
      freezable: false,
      fixedDay: null,
    }));
    update((d) => ({ ...d, safeMeals: [...d.safeMeals, ...newMeals] }));
    setAdded(names.length);
    setSelected(new Set());
    setError("");
    setStatus(
      `Added ${names.length} item${names.length === 1 ? "" : "s"} to your safe foods. You can add details like allergens or cost from the Safe meals page any time.`
    );
  }

  return (
    <>
      <Link className="back-link" href="/safe-meals">
        Back to safe meals
      </Link>
      <h1>Add safe foods from a receipt</h1>
      <p className="lede">
        Paste an online-shopping receipt, or upload a screenshot or PDF of
        one. Pick the foods you know work for you — they&rsquo;re added
        straight to your safe foods.
      </p>
      <p className="notice info">
        Your receipt is read <strong>on this device</strong> — it&rsquo;s
        never uploaded or stored anywhere.
      </p>

      {phase === "input" && (
        <>
          <div className="field">
            <label htmlFor={pasteId}>
              Paste receipt text
              <span className="label-hint">
                Copy everything from your order confirmation email or order
                page — prices and clutter are cleaned up automatically.
              </span>
            </label>
            <textarea
              id={pasteId}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={8}
              style={{ maxWidth: "40rem" }}
              aria-describedby={error ? "receipt-error" : undefined}
            />
          </div>
          <div className="button-row">
            <button type="button" onClick={readPasted}>
              Read pasted text
            </button>
          </div>

          <h2>Or upload a file</h2>
          <div className="field">
            <label htmlFor={fileId}>
              Screenshot or PDF of a receipt
              <span className="label-hint">
                PNG, JPG or PDF. Screenshots read best when they&rsquo;re
                straight-on and clear.
              </span>
            </label>
            <input
              id={fileId}
              type="file"
              accept="image/*,application/pdf,.pdf"
              onChange={(e) => readFile(e.target.files?.[0])}
            />
          </div>
        </>
      )}

      {phase === "reading" && (
        <p role="status" aria-live="polite" className="notice info">
          {status}
          {progress > 0 && ` ${progress}%`}
        </p>
      )}

      {phase === "choose" && (
        <section aria-labelledby="results-heading">
          <h2 id="results-heading" tabIndex={-1} ref={resultsRef}>
            Choose your safe foods
          </h2>
          <p role="status" aria-live="polite" className="notice info">
            {status}
          </p>

          {candidates.length > 0 && (
            <>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary small"
                  onClick={() =>
                    setSelected(
                      new Set(
                        candidates.filter((c) => !existingNames.has(c.toLowerCase()))
                      )
                    )
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setSelected(new Set())}
                >
                  Clear selection
                </button>
              </div>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {candidates.map((name) => {
                  const already = existingNames.has(name.toLowerCase());
                  return (
                    <li key={name}>
                      <div className="check-row">
                        <input
                          type="checkbox"
                          id={`item-${name}`}
                          checked={already || selected.has(name)}
                          disabled={already}
                          onChange={() => toggle(name)}
                        />
                        <label htmlFor={`item-${name}`}>
                          {name}
                          {already && (
                            <>
                              {" "}
                              <span className="badge accent">
                                already in your safe foods
                              </span>
                            </>
                          )}
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="button-row">
                <button type="button" onClick={addSelected}>
                  Add {selected.size > 0 ? selected.size : ""} selected to my
                  safe foods
                </button>
                {added > 0 && (
                  <Link className="button secondary" href="/safe-meals">
                    Go to my safe meals
                  </Link>
                )}
              </div>
            </>
          )}

          {removed.length > 0 && (
            <details>
              <summary>
                Items set aside as not food ({removed.length}) — check for
                mistakes
              </summary>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {removed.map((item) => (
                  <li
                    key={item.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      alignItems: "center",
                      padding: "0.3rem 0",
                    }}
                  >
                    <span>
                      {item.name}{" "}
                      <span className="muted">({item.reason})</span>
                    </span>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => rescue(item)}
                      aria-label={`This is food — move ${item.name} back to the list`}
                    >
                      This is food
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setPhase("input");
                setStatus("");
                setError("");
              }}
            >
              Start again with a different receipt
            </button>
          </div>
        </section>
      )}

      {error && (
        <p className="error-text" id="receipt-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
