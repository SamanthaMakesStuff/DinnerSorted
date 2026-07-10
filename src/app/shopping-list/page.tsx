"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { buildShoppingList, shoppingListAsText } from "@/lib/shopping";
import { suggestSubstitutes } from "@/lib/substitutions";
import { linksFor, SUPERMARKET_LINKS } from "@/lib/supermarkets";

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
  const prefs = data.preferences;
  // Search links for the user's chosen supermarkets (primary first);
  // fall back to all known shops if none are picked yet.
  const shopLinks =
    prefs.shopping.supermarkets.length > 0
      ? linksFor(prefs.shopping.supermarkets, prefs.shopping.primarySupermarket)
      : SUPERMARKET_LINKS;

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
      <p className="muted" style={{ maxWidth: "65ch" }}>
        Each item has links that open your supermarket&rsquo;s search for it —
        UK supermarkets don&rsquo;t allow apps to fill a basket directly, so
        it&rsquo;s one click per item rather than fully automatic.
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
            {group.lines.map((line) => {
              const swaps = suggestSubstitutes(line.name, prefs);
              return (
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
                  <details className="item-tools">
                    <summary>
                      Find {line.name} online, or swap it
                    </summary>
                    <p style={{ margin: "0.5rem 0 0.25rem" }}>
                      <strong>Search at your supermarket:</strong>
                    </p>
                    <ul className="link-row">
                      {shopLinks.map((shop) => (
                        <li key={shop.name}>
                          <a
                            href={shop.searchUrl(line.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {line.name} at {shop.name}
                            <span className="visually-hidden">
                              {" "}
                              (opens in a new tab)
                            </span>
                          </a>
                          {shop.note && (
                            <span className="label-hint">{shop.note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {swaps.length > 0 ? (
                      <>
                        <p style={{ margin: "0.75rem 0 0.25rem" }}>
                          <strong>If it&rsquo;s unavailable, these usually work:</strong>
                          <span className="label-hint">
                            Already filtered for your allergies and avoid-list.
                          </span>
                        </p>
                        <ul>
                          {swaps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="muted" style={{ margin: "0.75rem 0 0.25rem" }}>
                        No safe swap suggestions for this item — if it&rsquo;s
                        unavailable, the meal that needs it may be one to skip
                        this week.
                      </p>
                    )}
                  </details>
                </li>
              );
            })}
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
