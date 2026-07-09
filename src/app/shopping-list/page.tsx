"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { buildShoppingList, shoppingListAsText } from "@/lib/shopping";

export default function ShoppingListPage() {
  const { data, ready } = useStore();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState("");

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  const plan = data.planHistory[0] ?? null;
  if (!plan) {
    return (
      <>
        <h1>Shopping list</h1>
        <p className="lede">
          No plan yet — the shopping list is built from your weekly plan.
        </p>
        <p>
          <Link className="button" href="/plan">
            Plan my week first
          </Link>
        </p>
      </>
    );
  }

  const list = buildShoppingList(data, plan);
  const text = shoppingListAsText(list, plan.label);

  function toggle(key: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Shopping list copied to clipboard.");
    } catch {
      setCopyStatus(
        "Couldn't copy automatically — use the download button instead."
      );
    }
  }

  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dinnersorted-shopping-list.txt";
    a.click();
    URL.revokeObjectURL(url);
    setCopyStatus("Shopping list downloaded as a text file.");
  }

  return (
    <>
      <h1>Shopping list</h1>
      <p className="muted">
        {plan.label} · grouped by shop section · built from your chosen meal
        for each day.
      </p>

      <div className="button-row">
        <button type="button" className="secondary" onClick={copyText}>
          Copy as text
        </button>
        <button type="button" className="secondary" onClick={download}>
          Download as text file
        </button>
      </div>
      <p aria-live="polite" role="status" className={copyStatus ? "notice info" : "visually-hidden"}>
        {copyStatus}
      </p>

      {list.groups.length === 0 && (
        <p>
          Nothing to buy — your chosen meals have no ingredients listed (or
          they&rsquo;re all coming from the freezer).
        </p>
      )}

      {list.groups.map((group) => (
        <section key={group.category} className="shop-group" aria-labelledby={`grp-${group.category}`}>
          <h2 id={`grp-${group.category}`}>{group.category}</h2>
          <ul>
            {group.lines.map((line) => (
              <li key={line.key}>
                <div className="shop-line">
                  <input
                    type="checkbox"
                    id={`item-${line.key}`}
                    checked={ticked.has(line.key)}
                    onChange={() => toggle(line.key)}
                  />
                  <label
                    htmlFor={`item-${line.key}`}
                    className={ticked.has(line.key) ? "ticked" : undefined}
                  >
                    <strong>{line.name}</strong>
                    {line.estCost != null && ` — about £${line.estCost.toFixed(2)}`}
                    <span className="label-hint">
                      {line.quantities.join("; ")}
                    </span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {list.fromFreezer.length > 0 && (
        <section aria-labelledby="freezer-heading">
          <h2 id="freezer-heading">Already in your freezer</h2>
          <ul>
            {list.fromFreezer.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {list.estTotal != null && (
        <p className="notice info">
          Estimated total: <strong>£{list.estTotal.toFixed(2)}</strong>
          {data.preferences.budget.weeklyCap != null && (
            <>
              {" "}
              (your weekly budget is £
              {data.preferences.budget.weeklyCap.toFixed(2)})
            </>
          )}
        </p>
      )}
    </>
  );
}
