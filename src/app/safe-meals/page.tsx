"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { MealForm, emptyMeal } from "@/components/MealForm";
import {
  STARTER_MEALS,
  starterMealFitsDiet,
  starterMealFitsReligiousDiet,
} from "@/lib/starter-meals";
import { makeId } from "@/lib/defaults";
import { DAY_LABELS, type SafeMeal } from "@/lib/types";

export default function SafeMealsPage() {
  const { data, update, ready } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  const meals = data.safeMeals;
  const editing = editingId ? meals.find((m) => m.id === editingId) : null;

  function saveMeal(meal: SafeMeal) {
    update((d) => {
      const exists = d.safeMeals.some((m) => m.id === meal.id);
      return {
        ...d,
        safeMeals: exists
          ? d.safeMeals.map((m) => (m.id === meal.id ? meal : m))
          : [...d.safeMeals, meal],
      };
    });
    setStatus(`Saved “${meal.name}”.`);
    setAdding(false);
    setEditingId(null);
    headingRef.current?.focus();
  }

  function removeMeal(meal: SafeMeal) {
    update((d) => ({
      ...d,
      safeMeals: d.safeMeals.filter((m) => m.id !== meal.id),
    }));
    setStatus(`Removed “${meal.name}”.`);
  }

  function quickAdd(name: string) {
    const starter = STARTER_MEALS.find((m) => m.name === name);
    if (!starter) return;
    update((d) => ({
      ...d,
      safeMeals: [...d.safeMeals, { ...starter, id: makeId("meal") }],
    }));
    setStatus(`Added “${name}” to your safe meals. You can edit it any time.`);
  }

  const ownNames = new Set(meals.map((m) => m.name.toLowerCase()));
  const quickAddOptions = STARTER_MEALS.filter(
    (m) =>
      !ownNames.has(m.name.toLowerCase()) &&
      starterMealFitsDiet(m, data.preferences.dietType) &&
      starterMealFitsReligiousDiet(m, data.preferences.religiousDiet)
  );

  return (
    <>
      <h1 tabIndex={-1} ref={headingRef}>
        Your safe meals
      </h1>
      <p className="lede">
        The dinners you know work for you. The weekly plan only ever uses
        these (unless you switch on new-food suggestions). Three or four meals
        is plenty to start with.
      </p>

      <p aria-live="polite" role="status" className={status ? "notice info" : "visually-hidden"}>
        {status}
      </p>

      {meals.length > 0 && !editing && !adding && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {meals.map((meal) => (
            <li key={meal.id} className="card">
              <h2 style={{ margin: "0 0 0.3rem" }}>{meal.name}</h2>
              <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                {meal.effort === "low"
                  ? "Low effort"
                  : meal.effort === "medium"
                    ? "Medium effort"
                    : "High effort"}
                {meal.fixedDay ? ` · every ${DAY_LABELS[meal.fixedDay]}` : ""}
                {meal.freezable ? " · freezes well" : ""}
                {meal.isNew ? " · new food (not tried yet)" : ""}
                {meal.allergens.length > 0
                  ? ` · contains: ${meal.allergens.join(", ")}`
                  : ""}
              </p>
              {meal.notes && <p style={{ marginTop: 0 }}>{meal.notes}</p>}
              <div className="button-row" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    setEditingId(meal.id);
                    setAdding(false);
                    setStatus("");
                  }}
                  aria-label={`Edit ${meal.name}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => removeMeal(meal)}
                  aria-label={`Remove ${meal.name} from safe meals`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <section aria-label={`Editing ${editing.name}`}>
          <h2>Editing “{editing.name}”</h2>
          <MealForm
            key={editing.id}
            initial={editing}
            onSave={saveMeal}
            onCancel={() => setEditingId(null)}
            saveLabel="Save changes"
          />
        </section>
      )}

      {adding && (
        <section aria-label="Add a new safe meal">
          <h2>Add a safe meal</h2>
          <MealForm
            initial={emptyMeal()}
            onSave={saveMeal}
            onCancel={() => setAdding(false)}
            saveLabel="Add meal"
          />
        </section>
      )}

      {!adding && !editing && (
        <div className="button-row">
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setStatus("");
            }}
          >
            Add a safe meal
          </button>
        </div>
      )}

      {!adding && !editing && quickAddOptions.length > 0 && (
        <details>
          <summary>
            Quick-add a common meal ({quickAddOptions.length} available)
          </summary>
          <p className="muted">
            Ready-made entries with ingredients and rough costs filled in —
            only added if you choose them, and fully editable afterwards.
          </p>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {quickAddOptions.map((m) => (
              <li
                key={m.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "center",
                  padding: "0.35rem 0",
                }}
              >
                <span>
                  {m.name}{" "}
                  <span className="muted">
                    ({m.effort} effort
                    {m.allergens.length > 0
                      ? `; contains ${m.allergens.join(", ")}`
                      : ""}
                    )
                  </span>
                </span>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => quickAdd(m.name)}
                  aria-label={`Add ${m.name} to safe meals`}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
