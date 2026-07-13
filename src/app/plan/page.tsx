"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  buildMealPool,
  generateWeekPlan,
  reasonLabel,
  resolvePlanMeal,
} from "@/lib/generation";
import {
  productCookable,
  productToSafeMeal,
  type CatalogueProduct,
} from "@/lib/catalogue";
import { DAY_LABELS, MAX_PLAN_HISTORY, type SafeMeal } from "@/lib/types";
import { EmergencyMeals } from "@/components/EmergencyMeals";

export default function PlanPage() {
  const { data, update, ready } = useStore();
  const [showAnyway, setShowAnyway] = useState(false);
  const [status, setStatus] = useState("");
  const [products, setProducts] = useState<CatalogueProduct[]>([]);

  // Supermarket catalogue feeds the occasional new-food suggestion (only
  // used when the user has opted in). Absence is fine — starter library
  // fallback applies.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?limit=200")
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((body) => {
        if (!cancelled) setProducts(body.products ?? []);
      })
      .catch(() => {
        /* catalogue unavailable — suggestions fall back to starters */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  // Only suggest catalogue meals the user can actually cook (any-of tools),
  // recomputed from current preferences so equipment edits take effect.
  const catalogue: SafeMeal[] = products
    .filter((p) => productCookable(p, data.preferences))
    .map((p) => productToSafeMeal(p, { isNew: true }));

  const plan = data.planHistory[0] ?? null;
  const pool = buildMealPool(data.preferences, data.safeMeals, {
    includeOverridable: showAnyway,
  });

  function generate(opts: { replace: boolean; surprise?: boolean }) {
    const result = generateWeekPlan(data, {
      includeOverridable: showAnyway,
      surpriseSeed: opts.surprise ? String(Date.now()) : undefined,
      catalogue,
    });
    update((d) => ({
      ...d,
      planHistory: (opts.replace
        ? [result.plan, ...d.planHistory.slice(1)]
        : [result.plan, ...d.planHistory]
      ).slice(0, MAX_PLAN_HISTORY),
    }));
    setStatus(
      result.warnings.length > 0
        ? `Plan created with ${result.warnings.length} note${result.warnings.length > 1 ? "s" : ""} — see below.`
        : "Plan created. Every day has choices from your safe meals."
    );
  }

  function choose(day: string, mealId: string) {
    update((d) => ({
      ...d,
      planHistory: d.planHistory.map((p, i) =>
        i === 0
          ? {
              ...p,
              slots: p.slots.map((s) =>
                s.day === day ? { ...s, chosenId: mealId } : s
              ),
            }
          : p
      ),
    }));
  }

  if (data.safeMeals.length === 0) {
    return (
      <>
        <h1>Plan my week</h1>
        <p className="lede">
          Before planning, DinnerSorted needs at least a few{" "}
          <Link href="/safe-meals">safe meals</Link> to choose from — the
          dinners you already know work for you. Three or four is plenty.
        </p>
        <p>
          <Link className="button" href="/safe-meals">
            Add safe meals first
          </Link>
        </p>
        <EmergencyMeals />
      </>
    );
  }

  return (
    <>
      <h1>Plan my week</h1>
      <p className="lede">
        A small set of choices for each day, matched to that day&rsquo;s energy
        level. Nothing here is random — the same settings give the same plan.
      </p>

      <div className="check-row">
        <input
          type="checkbox"
          id="show-anyway"
          checked={showAnyway}
          onChange={(e) => setShowAnyway(e.target.checked)}
        />
        <label htmlFor="show-anyway">
          Include meals my avoid-lists would normally hide (“show anyway”)
          <span className="label-hint">
            Never includes medical-allergy exclusions — those stay excluded.
          </span>
        </label>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => generate({ replace: plan != null })}>
          {plan ? "Make a fresh plan for this week" : "Plan my week"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => generate({ replace: plan != null, surprise: true })}
        >
          Surprise me (shuffled order)
        </button>
      </div>

      <p aria-live="polite" role="status" className={status ? "notice info" : "visually-hidden"}>
        {status}
      </p>

      {plan && (
        <section aria-labelledby="current-plan-heading">
          <h2 id="current-plan-heading">{plan.label}</h2>
          {plan.budgetWarning && (
            <p className="notice warn" role="alert">
              <strong>Over budget:</strong> {plan.budgetWarning}
            </p>
          )}
          {(() => {
            const distinct = new Set(plan.slots.flatMap((s) => s.optionIds)).size;
            if (distinct === 0 || distinct > 2) return null;
            return (
              <p className="notice info">
                Only {distinct} of your safe meals{" "}
                {distinct === 1 ? "fits" : "fit"} this week&rsquo;s energy
                settings, so days repeat. For more variety, add more
                low-effort meals to your{" "}
                <Link href="/safe-meals">safe meals</Link> (or edit a
                meal&rsquo;s effort level if it&rsquo;s easier to make than
                listed).
              </p>
            );
          })()}
          {plan.estTotal != null && !plan.budgetWarning && (
            <p className="muted">
              Estimated shopping total: £{plan.estTotal.toFixed(2)}
              {data.preferences.budget.weeklyCap != null &&
                ` (budget £${data.preferences.budget.weeklyCap.toFixed(2)})`}
            </p>
          )}

          {plan.slots.map((slot) => (
            <fieldset key={slot.day} className="day-card" style={{ border: "2px solid var(--border)" }}>
              <legend>
                {DAY_LABELS[slot.day]}{" "}
                <span className="muted" style={{ fontWeight: 400 }}>
                  ({data.preferences.energyByDay[slot.day]} energy day)
                </span>
              </legend>
              {slot.optionIds.length === 0 ? (
                <p style={{ margin: 0 }}>
                  {slot.note ?? "No matching meals for this day."}{" "}
                  Your emergency meals below are always an option.
                </p>
              ) : (
                slot.optionIds.map((id) => {
                  const meal = resolvePlanMeal(data, id);
                  if (!meal) return null;
                  const inputId = `${slot.day}-${id}`;
                  return (
                    <div className="option-row" key={id}>
                      <input
                        type="radio"
                        id={inputId}
                        name={`choice-${slot.day}`}
                        checked={slot.chosenId === id}
                        onChange={() => choose(slot.day, id)}
                      />
                      <label htmlFor={inputId}>
                        {meal.name}
                        {slot.freezerOptionIds.includes(id) && (
                          <>
                            {" "}
                            <span className="badge accent">from freezer — no shopping needed</span>
                          </>
                        )}
                        {meal.isNew && (
                          <>
                            {" "}
                            <span className="badge">new food suggestion</span>
                          </>
                        )}
                        <span className="label-hint">
                          {meal.effort} effort
                          {meal.estCost != null
                            ? ` · about £${meal.estCost.toFixed(2)} per person`
                            : ""}
                        </span>
                      </label>
                    </div>
                  );
                })
              )}
            </fieldset>
          ))}

          <div className="button-row">
            <Link className="button" href="/shopping-list">
              Get the shopping list for this plan
            </Link>
          </div>
        </section>
      )}

      {pool.excluded.length > 0 && (
        <details>
          <summary>
            Why {pool.excluded.length} of your meal{pool.excluded.length > 1 ? "s aren't" : " isn't"}{" "}
            being offered
          </summary>
          <ul>
            {pool.excluded.map(({ meal, reasons, overridable }) => (
              <li key={meal.id} style={{ marginBottom: "0.5rem" }}>
                <strong>{meal.name}</strong> —{" "}
                {reasons.map((r) => reasonLabel(r)).join("; ")}.
                {overridable ? (
                  <span className="muted">
                    {" "}
                    Tick “show anyway” above to include it.
                  </span>
                ) : (
                  <span className="muted"> This can&rsquo;t be overridden.</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <EmergencyMeals />
    </>
  );
}
