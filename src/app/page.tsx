"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { resolvePlanMeal } from "@/lib/generation";
import { DAY_LABELS } from "@/lib/types";
import { EmergencyMeals } from "@/components/EmergencyMeals";

export default function HomePage() {
  const { data, ready } = useStore();

  if (!ready) {
    return <p aria-live="polite">Loading your data…</p>;
  }

  const plan = data.planHistory[0] ?? null;
  const hasPrefs =
    data.safeMeals.length > 0 || data.preferences.allergens.length > 0;

  return (
    <>
      <h1>This week</h1>

      {!plan && (
        <>
          <p className="lede">
            DinnerSorted decides “what&rsquo;s for dinner” so you don&rsquo;t
            have to. Tell it your safe meals and preferences once — it plans
            your week and writes the shopping list.
          </p>
          <ol>
            <li>
              <Link href="/preferences">Set your preferences</Link> — allergies,
              sensory needs, energy levels, budget. Everything is optional
              except what you choose to add.
            </li>
            <li>
              <Link href="/safe-meals">Add your safe meals</Link> — the dinners
              you know work for you. Three or four is plenty to start.
            </li>
            <li>
              <Link href="/plan">Plan your week</Link> — a small, predictable
              set of choices for each day. No surprises.
            </li>
          </ol>
          {!hasPrefs && (
            <p className="muted">
              Using DinnerSorted without an account? Your data stays in this
              browser tab only. <Link href="/data">Download a backup</Link>{" "}
              whenever you like.
            </p>
          )}
        </>
      )}

      {plan && (
        <>
          <p className="muted">
            {plan.label} · generated{" "}
            {new Date(plan.createdAt).toLocaleDateString("en-GB")}
          </p>
          {plan.budgetWarning && (
            <p className="notice warn" role="status">
              <strong>Budget note:</strong> {plan.budgetWarning}
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {plan.slots.map((slot) => {
              const meal = slot.chosenId
                ? resolvePlanMeal(data, slot.chosenId)
                : null;
              return (
                <li key={slot.day} className="day-card">
                  <h3>{DAY_LABELS[slot.day]}</h3>
                  {meal ? (
                    <p style={{ margin: 0 }}>
                      {meal.name}
                      {slot.freezerOptionIds.includes(meal.id) && (
                        <>
                          {" "}
                          <span className="badge accent">from freezer</span>
                        </>
                      )}
                      {meal.isNew && (
                        <>
                          {" "}
                          <span className="badge">new food (you opted in)</span>
                        </>
                      )}
                    </p>
                  ) : (
                    <p style={{ margin: 0 }} className="muted">
                      {slot.note ??
                        "Nothing picked for this day — your emergency meals are always fine."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="button-row">
            <Link className="button" href="/plan">
              Change this week&rsquo;s plan
            </Link>
            <Link className="button secondary" href="/shopping-list">
              View shopping list
            </Link>
          </div>
        </>
      )}

      <EmergencyMeals />
    </>
  );
}
