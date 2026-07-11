"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { buildMealPool, reasonLabel } from "@/lib/generation";
import {
  pricePerPortion,
  productToSafeMeal,
  type CatalogueProduct,
} from "@/lib/catalogue";
import type { SafeMeal } from "@/lib/types";

export default function BrowsePage() {
  const { data, update, ready } = useStore();
  const searchId = useId();
  const [productsList, setProductsList] = useState<CatalogueProduct[] | null>(
    null
  );
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showAnyway, setShowAnyway] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "The catalogue couldn't be loaded.");
        }
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setProductsList(body.products ?? []);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(String(e.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prefs = data.preferences;

  // Convert products to meals and run them through the same safety engine
  // as everything else: medical allergies excluded outright, preference
  // filters overridable via "show anyway".
  const { visible, excludedCount, excluded } = useMemo(() => {
    if (!productsList) return { visible: [], excludedCount: 0, excluded: [] };
    const q = search.trim().toLowerCase();
    const searched = productsList.filter(
      (p) => !q || p.name.toLowerCase().includes(q)
    );
    const asMeals = searched.map((p) => ({
      product: p,
      meal: productToSafeMeal(p, { isNew: false }),
    }));
    const pool = buildMealPool(
      prefs,
      asMeals.map((x) => x.meal),
      { includeOverridable: showAnyway }
    );
    const eligibleIds = new Set(pool.eligible.map((m) => m.id));
    return {
      visible: asMeals.filter((x) => eligibleIds.has(x.meal.id)),
      excludedCount: pool.excluded.length,
      excluded: pool.excluded,
    };
  }, [productsList, search, prefs, showAnyway]);

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  const ownNames = new Set(data.safeMeals.map((m) => m.name.toLowerCase()));

  function addProduct(product: CatalogueProduct) {
    const meal: SafeMeal = {
      ...productToSafeMeal(product, { isNew: false }),
      // fresh id so re-adding after a removal never collides
      id: `meal_${product.id}_${Date.now().toString(36)}`,
    };
    update((d) => ({ ...d, safeMeals: [...d.safeMeals, meal] }));
    setStatus(`Added “${product.name}” to your safe foods.`);
  }

  return (
    <>
      <h1>Ready meals at Tesco</h1>
      <p className="lede">
        Real supermarket meals with prices, ingredients and allergens —
        already filtered by your allergy and sensory settings. Add anything
        that works for you to your safe foods.
      </p>

      {loadError && (
        <p className="notice error" role="alert">
          {loadError} If accounts are switched on for this deployment, the
          catalogue appears after the first scraper run — see the project
          README.
        </p>
      )}
      {!loadError && productsList == null && (
        <p aria-live="polite">Loading the catalogue…</p>
      )}
      {productsList != null && productsList.length === 0 && (
        <p className="notice info">
          The catalogue is empty. Run the Tesco scraper tool
          (tools/tesco-scraper) from your computer to fill it — instructions
          are in that folder&rsquo;s README.
        </p>
      )}

      {productsList != null && productsList.length > 0 && (
        <>
          <div className="field">
            <label htmlFor={searchId}>Search meals</label>
            <input
              id={searchId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. curry"
              style={{ maxWidth: "18rem" }}
            />
          </div>
          <div className="check-row">
            <input
              type="checkbox"
              id="browse-show-anyway"
              checked={showAnyway}
              onChange={(e) => setShowAnyway(e.target.checked)}
            />
            <label htmlFor="browse-show-anyway">
              Include meals my avoid-lists would normally hide
              <span className="label-hint">
                Medical-allergy exclusions always stay hidden.
              </span>
            </label>
          </div>

          <p aria-live="polite" role="status" className={status ? "notice info" : "visually-hidden"}>
            {status}
          </p>

          <p className="muted">
            Showing {visible.length} meal{visible.length === 1 ? "" : "s"}
            {excludedCount > 0 &&
              ` (${excludedCount} hidden by your settings — details below)`}
            .
          </p>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {visible.map(({ product }) => {
              const perPortion = pricePerPortion(product);
              const already = ownNames.has(product.name.toLowerCase());
              return (
                <li key={product.id} className="card">
                  <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.1rem" }}>
                    {product.name}
                  </h2>
                  <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                    {product.pricePence != null &&
                      `£${(product.pricePence / 100).toFixed(2)}`}
                    {product.portions != null &&
                      ` · serves ${product.portions}`}
                    {perPortion != null &&
                      product.portions != null &&
                      product.portions > 1 &&
                      ` (£${perPortion.toFixed(2)} a portion)`}
                    {product.cookMinutes != null &&
                      ` · about ${product.cookMinutes} min`}
                    {product.allergens.length > 0 &&
                      ` · contains: ${product.allergens.join(", ")}`}
                  </p>
                  {product.ingredientsText && (
                    <details>
                      <summary>Ingredients</summary>
                      <p>{product.ingredientsText}</p>
                      {product.mayContain.length > 0 && (
                        <p className="muted">
                          May contain: {product.mayContain.join(", ")}
                        </p>
                      )}
                    </details>
                  )}
                  <div className="button-row" style={{ margin: "0.5rem 0 0" }}>
                    {already ? (
                      <span className="badge accent">
                        already in your safe foods
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => addProduct(product)}
                        aria-label={`Add ${product.name} to safe foods`}
                      >
                        Add to my safe foods
                      </button>
                    )}
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button secondary small"
                    >
                      View at {product.supermarket}
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>

          {excluded.length > 0 && (
            <details>
              <summary>
                Why {excluded.length} meal{excluded.length === 1 ? " is" : "s are"}{" "}
                hidden
              </summary>
              <ul>
                {excluded.slice(0, 50).map(({ meal, reasons, overridable }) => (
                  <li key={meal.id} style={{ marginBottom: "0.4rem" }}>
                    <strong>{meal.name}</strong> —{" "}
                    {reasons.map((r) => reasonLabel(r)).join("; ")}.
                    {overridable ? (
                      <span className="muted"> Tick “show anyway” to include it.</span>
                    ) : (
                      <span className="muted"> This can&rsquo;t be overridden.</span>
                    )}
                  </li>
                ))}
                {excluded.length > 50 && (
                  <li className="muted">…and {excluded.length - 50} more.</li>
                )}
              </ul>
            </details>
          )}
        </>
      )}

      <p>
        <Link href="/safe-meals">Back to your safe meals</Link>
      </p>
    </>
  );
}
