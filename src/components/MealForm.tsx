"use client";

/**
 * Add/edit form for a safe meal. Explicit save button (edits here shouldn't
 * apply live to a meal the planner may be using), specific inline errors
 * associated with their fields.
 */
import { useId, useState } from "react";
import type { Ingredient, SafeMeal, ShopCategory } from "@/lib/types";
import {
  DAYS,
  DAY_LABELS,
  EQUIPMENT_OPTIONS,
  SHOP_CATEGORIES,
  UK_ALLERGENS,
} from "@/lib/types";
import { makeId } from "@/lib/defaults";
import { TagListInput } from "./TagListInput";

export function emptyMeal(): SafeMeal {
  return {
    id: makeId("meal"),
    name: "",
    notes: "",
    effort: "low",
    steps: null,
    pans: null,
    equipment: [],
    temperature: "hot",
    tags: [],
    ingredients: [],
    estCost: null,
    allergens: [],
    traceAllergens: [],
    isNew: false,
    freezable: false,
    fixedDay: null,
  };
}

export function MealForm({
  initial,
  onSave,
  onCancel,
  saveLabel = "Save meal",
}: {
  initial: SafeMeal;
  onSave: (meal: SafeMeal) => void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const [meal, setMeal] = useState<SafeMeal>(initial);
  const [error, setError] = useState("");
  const ids = {
    name: useId(),
    notes: useId(),
    effort: useId(),
    steps: useId(),
    pans: useId(),
    temperature: useId(),
    cost: useId(),
    fixedDay: useId(),
    ingName: useId(),
    ingCategory: useId(),
    ingQty: useId(),
    ingCost: useId(),
  };

  const [ingDraft, setIngDraft] = useState<Ingredient>({
    name: "",
    category: "Cupboard",
    quantity: "",
    estCost: null,
  });

  function set<K extends keyof SafeMeal>(key: K, value: SafeMeal[K]) {
    setMeal((m) => ({ ...m, [key]: value }));
  }

  function addIngredient() {
    if (!ingDraft.name.trim()) return;
    set("ingredients", [...meal.ingredients, { ...ingDraft, name: ingDraft.name.trim() }]);
    setIngDraft({ name: "", category: ingDraft.category, quantity: "", estCost: null });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!meal.name.trim()) {
      setError("Please give the meal a name — that's the only required field.");
      return;
    }
    setError("");
    onSave({ ...meal, name: meal.name.trim() });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={ids.name}>Meal name</label>
        <input
          id={ids.name}
          type="text"
          value={meal.name}
          onChange={(e) => set("name", e.target.value)}
          aria-describedby={error ? `${ids.name}-error` : undefined}
          aria-invalid={error ? true : undefined}
          required
        />
        {error && (
          <p className="error-text" id={`${ids.name}-error`}>
            {error}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={ids.notes}>
          Notes <span className="label-hint">Optional.</span>
        </label>
        <textarea
          id={ids.notes}
          value={meal.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor={ids.effort}>Effort needed</label>
          <select
            id={ids.effort}
            value={meal.effort}
            onChange={(e) => set("effort", e.target.value as SafeMeal["effort"])}
          >
            <option value="low">Low — fine on a bad day</option>
            <option value="medium">Medium — needs some energy</option>
            <option value="high">High — a good-day meal</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={ids.temperature}>Served</label>
          <select
            id={ids.temperature}
            value={meal.temperature}
            onChange={(e) =>
              set("temperature", e.target.value as SafeMeal["temperature"])
            }
          >
            <option value="hot">Hot</option>
            <option value="cold">Cold</option>
            <option value="room">Room temperature</option>
            <option value="any">Any</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={ids.steps}>
            Number of steps <span className="label-hint">Optional.</span>
          </label>
          <input
            id={ids.steps}
            type="number"
            min={0}
            value={meal.steps ?? ""}
            onChange={(e) =>
              set("steps", e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
        <div className="field">
          <label htmlFor={ids.pans}>
            Pans/dishes used <span className="label-hint">Optional.</span>
          </label>
          <input
            id={ids.pans}
            type="number"
            min={0}
            value={meal.pans ?? ""}
            onChange={(e) =>
              set("pans", e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
        <div className="field">
          <label htmlFor={ids.cost}>
            Estimated cost per person (£){" "}
            <span className="label-hint">Optional — used for budget checks.</span>
          </label>
          <input
            id={ids.cost}
            type="number"
            min={0}
            step="0.01"
            value={meal.estCost ?? ""}
            onChange={(e) =>
              set("estCost", e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
        <div className="field">
          <label htmlFor={ids.fixedDay}>
            Always on a fixed day?{" "}
            <span className="label-hint">e.g. “same dinner every Tuesday”.</span>
          </label>
          <select
            id={ids.fixedDay}
            value={meal.fixedDay ?? ""}
            onChange={(e) =>
              set("fixedDay", (e.target.value || null) as SafeMeal["fixedDay"])
            }
          >
            <option value="">No fixed day</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                Every {DAY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h3 id={`${ids.name}-equipment`}>Equipment needed</h3>
      <div className="grid-2" role="group" aria-labelledby={`${ids.name}-equipment`}>
        {EQUIPMENT_OPTIONS.map((eq) => (
          <div className="check-row" key={eq}>
            <input
              type="checkbox"
              id={`${ids.name}-eq-${eq}`}
              checked={meal.equipment.includes(eq)}
              onChange={(e) =>
                set(
                  "equipment",
                  e.target.checked
                    ? [...meal.equipment, eq]
                    : meal.equipment.filter((x) => x !== eq)
                )
              }
            />
            <label htmlFor={`${ids.name}-eq-${eq}`}>{eq}</label>
          </div>
        ))}
      </div>

      <TagListInput
        label="Texture / flavour tags"
        hint="Used by your sensory filters — e.g. mushy, crunchy, strong smell, beige."
        values={meal.tags}
        onChange={(v) => set("tags", v)}
        placeholder="e.g. crunchy"
      />

      <h3>Ingredients</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Used to build your shopping list. Costs are optional.
      </p>
      {meal.ingredients.length > 0 && (
        <table>
          <caption className="visually-hidden">Ingredients for this meal</caption>
          <thead>
            <tr>
              <th scope="col">Ingredient</th>
              <th scope="col">Shop section</th>
              <th scope="col">Amount</th>
              <th scope="col">Est. £</th>
              <th scope="col">Remove</th>
            </tr>
          </thead>
          <tbody>
            {meal.ingredients.map((ing, i) => (
              <tr key={`${ing.name}-${i}`}>
                <th scope="row">{ing.name}</th>
                <td>{ing.category}</td>
                <td>{ing.quantity || "—"}</td>
                <td>{ing.estCost != null ? ing.estCost.toFixed(2) : "—"}</td>
                <td>
                  <button
                    type="button"
                    className="secondary small"
                    aria-label={`Remove ingredient ${ing.name}`}
                    onClick={() =>
                      set(
                        "ingredients",
                        meal.ingredients.filter((_, j) => j !== i)
                      )
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="grid-2" style={{ alignItems: "end", marginTop: "0.75rem" }}>
        <div className="field">
          <label htmlFor={ids.ingName}>Ingredient name</label>
          <input
            id={ids.ingName}
            type="text"
            value={ingDraft.name}
            onChange={(e) => setIngDraft({ ...ingDraft, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIngredient();
              }
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={ids.ingCategory}>Shop section</label>
          <select
            id={ids.ingCategory}
            value={ingDraft.category}
            onChange={(e) =>
              setIngDraft({ ...ingDraft, category: e.target.value as ShopCategory })
            }
          >
            {SHOP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={ids.ingQty}>
            Amount <span className="label-hint">e.g. 2 tins, 500g.</span>
          </label>
          <input
            id={ids.ingQty}
            type="text"
            value={ingDraft.quantity}
            onChange={(e) => setIngDraft({ ...ingDraft, quantity: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={ids.ingCost}>
            Est. cost (£) <span className="label-hint">Optional.</span>
          </label>
          <input
            id={ids.ingCost}
            type="number"
            min={0}
            step="0.01"
            value={ingDraft.estCost ?? ""}
            onChange={(e) =>
              setIngDraft({
                ...ingDraft,
                estCost: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
      </div>
      <button type="button" className="secondary" onClick={addIngredient}>
        Add ingredient
      </button>

      <h3 id={`${ids.name}-allergens`}>Contains allergens</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Tick anything this meal contains, so your allergy settings can exclude
        it properly.
      </p>
      <div className="grid-2" role="group" aria-labelledby={`${ids.name}-allergens`}>
        {UK_ALLERGENS.map((a) => (
          <div className="check-row" key={a}>
            <input
              type="checkbox"
              id={`${ids.name}-al-${a}`}
              checked={meal.allergens.includes(a)}
              onChange={(e) =>
                set(
                  "allergens",
                  e.target.checked
                    ? [...meal.allergens, a]
                    : meal.allergens.filter((x) => x !== a)
                )
              }
            />
            <label htmlFor={`${ids.name}-al-${a}`}>{a}</label>
          </div>
        ))}
      </div>
      <TagListInput
        label="Other allergens it contains"
        hint="Anything not in the standard list."
        values={meal.allergens.filter(
          (a) => !UK_ALLERGENS.includes(a as (typeof UK_ALLERGENS)[number])
        )}
        onChange={(custom) =>
          set("allergens", [
            ...meal.allergens.filter((a) =>
              UK_ALLERGENS.includes(a as (typeof UK_ALLERGENS)[number])
            ),
            ...custom,
          ])
        }
      />
      <TagListInput
        label="“May contain” traces"
        hint="Allergens present only as possible cross-contamination."
        values={meal.traceAllergens}
        onChange={(v) => set("traceAllergens", v)}
      />

      <div className="check-row">
        <input
          type="checkbox"
          id={`${ids.name}-freezable`}
          checked={meal.freezable}
          onChange={(e) => set("freezable", e.target.checked)}
        />
        <label htmlFor={`${ids.name}-freezable`}>
          Freezes well (good for batch cooking)
        </label>
      </div>
      <div className="check-row">
        <input
          type="checkbox"
          id={`${ids.name}-isnew`}
          checked={meal.isNew}
          onChange={(e) => set("isNew", e.target.checked)}
        />
        <label htmlFor={`${ids.name}-isnew`}>
          This is a new food I haven&rsquo;t tried yet
          <span className="label-hint">
            Only suggested if “suggest new foods” is switched on in preferences.
          </span>
        </label>
      </div>

      <div className="button-row">
        <button type="submit">{saveLabel}</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
