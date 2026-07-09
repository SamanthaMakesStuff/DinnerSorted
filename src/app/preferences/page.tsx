"use client";

import { useId, useState } from "react";
import { useStore } from "@/lib/store";
import { TagListInput } from "@/components/TagListInput";
import {
  DAYS,
  DAY_LABELS,
  DIET_TYPES,
  EQUIPMENT_OPTIONS,
  ROTATION_LABELS,
  UK_ALLERGENS,
  UK_SUPERMARKETS,
  type AllergenEntry,
  type Day,
  type DietType,
  type EnergyLevel,
  type Preferences,
  type RotationSetting,
  type TemperaturePref,
} from "@/lib/types";

const DIET_LABELS: Record<DietType, string> = {
  omnivore: "Omnivore (everything)",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian (fish but no meat)",
  other: "Other",
};

export default function PreferencesPage() {
  const { data, update, ready, syncState } = useStore();
  const prefs = data.preferences;
  const ids = {
    dietOther: useId(),
    temperature: useId(),
    visual: useId(),
    maxSteps: useId(),
    maxIngredients: useId(),
    maxPans: useId(),
    weeklyCap: useId(),
    perMealCap: useId(),
    householdSize: useId(),
    householdNotes: useId(),
    primarySupermarket: useId(),
    medNotes: useId(),
    allergenSelect: useId(),
    allergenCustom: useId(),
  };

  const [allergenPick, setAllergenPick] = useState<string>(UK_ALLERGENS[0]);
  const [allergenCustom, setAllergenCustom] = useState("");
  const [allergenError, setAllergenError] = useState("");

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  function setPrefs(patch: Partial<Preferences>) {
    update((d) => ({ ...d, preferences: { ...d.preferences, ...patch } }));
  }

  function addAllergen(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      setAllergenError("Type or choose an allergen first, then press Add.");
      return;
    }
    if (
      prefs.allergens.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setAllergenError(`${trimmed} is already on your allergen list.`);
      return;
    }
    setAllergenError("");
    setPrefs({
      allergens: [
        ...prefs.allergens,
        { name: trimmed, severity: "avoid", crossContamination: false },
      ],
    });
  }

  function updateAllergen(name: string, patch: Partial<AllergenEntry>) {
    setPrefs({
      allergens: prefs.allergens.map((a) =>
        a.name === name ? { ...a, ...patch } : a
      ),
    });
  }

  return (
    <>
      <h1>Your preferences</h1>
      <p className="lede">
        Fill in as much or as little as you like — everything can be changed
        later. Changes save automatically as you go
        {syncState === "guest" ? " (to this browser tab)" : ""}.
      </p>

      {/* ---------------- Allergies & medical ---------------- */}
      <fieldset>
        <legend>Allergies &amp; medical needs</legend>
        <p className="muted" style={{ marginTop: 0 }}>
          Anything marked <strong>medical / dangerous</strong> is completely
          excluded from every suggestion — no swaps, no “are you sure”, ever.
        </p>

        <div className="field">
          <label htmlFor={ids.allergenSelect}>Add a standard UK allergen</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <select
              id={ids.allergenSelect}
              value={allergenPick}
              onChange={(e) => setAllergenPick(e.target.value)}
              style={{ maxWidth: "18rem" }}
            >
              {UK_ALLERGENS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary small"
              onClick={() => addAllergen(allergenPick)}
            >
              Add allergen
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor={ids.allergenCustom}>
            Add another allergen or intolerance
            <span className="label-hint">
              Anything not on the standard list, e.g. kiwi, garlic.
            </span>
          </label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              id={ids.allergenCustom}
              type="text"
              value={allergenCustom}
              onChange={(e) => setAllergenCustom(e.target.value)}
              aria-describedby={allergenError ? "allergen-error" : undefined}
              aria-invalid={allergenError ? true : undefined}
              style={{ maxWidth: "18rem" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAllergen(allergenCustom);
                  setAllergenCustom("");
                }
              }}
            />
            <button
              type="button"
              className="secondary small"
              onClick={() => {
                addAllergen(allergenCustom);
                setAllergenCustom("");
              }}
            >
              Add custom allergen
            </button>
          </div>
          {allergenError && (
            <p className="error-text" id="allergen-error">
              {allergenError}
            </p>
          )}
        </div>

        {prefs.allergens.length > 0 && (
          <table>
            <caption className="visually-hidden">
              Your allergens and how strictly each is excluded
            </caption>
            <thead>
              <tr>
                <th scope="col">Allergen</th>
                <th scope="col">How strict?</th>
                <th scope="col">Cross-contamination</th>
                <th scope="col">Remove</th>
              </tr>
            </thead>
            <tbody>
              {prefs.allergens.map((a) => (
                <tr key={a.name}>
                  <th scope="row">{a.name}</th>
                  <td>
                    <div className="check-row">
                      <input
                        type="radio"
                        id={`sev-avoid-${a.name}`}
                        name={`severity-${a.name}`}
                        checked={a.severity === "avoid"}
                        onChange={() =>
                          updateAllergen(a.name, { severity: "avoid" })
                        }
                      />
                      <label htmlFor={`sev-avoid-${a.name}`}>
                        Avoid (preference or intolerance)
                      </label>
                    </div>
                    <div className="check-row">
                      <input
                        type="radio"
                        id={`sev-medical-${a.name}`}
                        name={`severity-${a.name}`}
                        checked={a.severity === "medical"}
                        onChange={() =>
                          updateAllergen(a.name, { severity: "medical" })
                        }
                      />
                      <label htmlFor={`sev-medical-${a.name}`}>
                        Medical / dangerous (strict exclusion)
                      </label>
                    </div>
                  </td>
                  <td>
                    <div className="check-row">
                      <input
                        type="checkbox"
                        id={`cc-${a.name}`}
                        checked={a.crossContamination}
                        onChange={(e) =>
                          updateAllergen(a.name, {
                            crossContamination: e.target.checked,
                          })
                        }
                      />
                      <label htmlFor={`cc-${a.name}`}>
                        Also avoid “may contain” traces
                      </label>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() =>
                        setPrefs({
                          allergens: prefs.allergens.filter(
                            (x) => x.name !== a.name
                          ),
                        })
                      }
                      aria-label={`Remove ${a.name} from allergen list`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </fieldset>

      {/* ---------------- Diet type ---------------- */}
      <fieldset>
        <legend>Diet type</legend>
        {DIET_TYPES.map((d) => (
          <div className="check-row" key={d}>
            <input
              type="radio"
              id={`diet-${d}`}
              name="dietType"
              checked={prefs.dietType === d}
              onChange={() => setPrefs({ dietType: d })}
            />
            <label htmlFor={`diet-${d}`}>{DIET_LABELS[d]}</label>
          </div>
        ))}
        {prefs.dietType === "other" && (
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label htmlFor={ids.dietOther}>Describe your diet</label>
            <input
              id={ids.dietOther}
              type="text"
              value={prefs.dietTypeOther}
              onChange={(e) => setPrefs({ dietTypeOther: e.target.value })}
            />
          </div>
        )}
      </fieldset>

      {/* ---------------- Safe food behaviour ---------------- */}
      <fieldset>
        <legend>How your safe meals repeat</legend>
        {(Object.keys(ROTATION_LABELS) as RotationSetting[]).map((r) => (
          <div className="check-row" key={r}>
            <input
              type="radio"
              id={`rot-${r}`}
              name="rotation"
              checked={prefs.rotation === r}
              onChange={() => setPrefs({ rotation: r })}
            />
            <label htmlFor={`rot-${r}`}>{ROTATION_LABELS[r]}</label>
          </div>
        ))}

        <div className="check-row" style={{ marginTop: "1rem" }}>
          <input
            type="checkbox"
            id="new-foods"
            checked={prefs.newFoodsOptIn}
            onChange={(e) => setPrefs({ newFoodsOptIn: e.target.checked })}
          />
          <label htmlFor="new-foods">
            Suggest new foods sometimes
            <span className="label-hint">
              Off by default. When off, DinnerSorted will never suggest a meal
              you haven&rsquo;t marked as safe.
            </span>
          </label>
        </div>

        <div className="field" style={{ marginTop: "1rem" }}>
          <span id="options-per-slot-label" style={{ fontWeight: 600 }}>
            Choices shown per day
          </span>
          <span className="label-hint">
            A small fixed number, so choosing stays easy.
          </span>
          <div
            role="radiogroup"
            aria-labelledby="options-per-slot-label"
            style={{ marginTop: "0.4rem" }}
          >
            {[2, 3].map((n) => (
              <div className="check-row" key={n}>
                <input
                  type="radio"
                  id={`opts-${n}`}
                  name="optionsPerSlot"
                  checked={prefs.optionsPerSlot === n}
                  onChange={() => setPrefs({ optionsPerSlot: n as 2 | 3 })}
                />
                <label htmlFor={`opts-${n}`}>{n} choices</label>
              </div>
            ))}
          </div>
        </div>
      </fieldset>

      {/* ---------------- Foods to avoid ---------------- */}
      <fieldset>
        <legend>Foods &amp; flavours to avoid</legend>
        <p className="muted" style={{ marginTop: 0 }}>
          Dislikes and no-thank-yous — separate from allergies. Meals matching
          these are hidden by default, but you can choose “show anyway” when
          planning, so nothing is ever silently off-limits.
        </p>
        <TagListInput
          label="Foods or flavours to avoid"
          hint="For example: mushrooms, aniseed, very spicy."
          values={prefs.avoidFoods}
          onChange={(v) => setPrefs({ avoidFoods: v })}
          placeholder="e.g. mushrooms"
        />
      </fieldset>

      {/* ---------------- Sensory preferences ---------------- */}
      <fieldset>
        <legend>Sensory preferences</legend>
        <TagListInput
          label="Textures to avoid"
          hint="For example: mushy, slimy, mixed textures."
          values={prefs.sensory.textureAvoid}
          onChange={(v) =>
            setPrefs({ sensory: { ...prefs.sensory, textureAvoid: v } })
          }
          placeholder="e.g. mushy"
        />
        <TagListInput
          label="Textures you prefer"
          hint="For example: crunchy, smooth."
          values={prefs.sensory.texturePrefer}
          onChange={(v) =>
            setPrefs({ sensory: { ...prefs.sensory, texturePrefer: v } })
          }
          placeholder="e.g. crunchy"
        />
        <div className="check-row">
          <input
            type="checkbox"
            id="foods-touch"
            checked={!prefs.sensory.foodsCanTouch}
            onChange={(e) =>
              setPrefs({
                sensory: { ...prefs.sensory, foodsCanTouch: !e.target.checked },
              })
            }
          />
          <label htmlFor="foods-touch">
            Foods should not touch on the plate
          </label>
        </div>
        <div className="field" style={{ marginTop: "0.75rem" }}>
          <label htmlFor={ids.temperature}>Meal temperature preference</label>
          <select
            id={ids.temperature}
            value={prefs.sensory.temperature}
            onChange={(e) =>
              setPrefs({
                sensory: {
                  ...prefs.sensory,
                  temperature: e.target.value as TemperaturePref,
                },
              })
            }
            style={{ maxWidth: "14rem" }}
          >
            <option value="any">No preference</option>
            <option value="hot">Hot meals</option>
            <option value="cold">Cold meals</option>
            <option value="room">Room temperature</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={ids.visual}>
            Visual or colour sensitivities
            <span className="label-hint">
              For example: no sauces that change the colour of food.
            </span>
          </label>
          <textarea
            id={ids.visual}
            value={prefs.sensory.visualNotes}
            onChange={(e) =>
              setPrefs({
                sensory: { ...prefs.sensory, visualNotes: e.target.value },
              })
            }
          />
        </div>
        <div className="check-row">
          <input
            type="checkbox"
            id="smell-sensitive"
            checked={prefs.sensory.smellSensitive}
            onChange={(e) =>
              setPrefs({
                sensory: { ...prefs.sensory, smellSensitive: e.target.checked },
              })
            }
          />
          <label htmlFor="smell-sensitive">
            I&rsquo;m sensitive to strong cooking smells
            <span className="label-hint">
              Meals tagged “strong smell” will be hidden by default.
            </span>
          </label>
        </div>
      </fieldset>

      {/* ---------------- Energy & capability ---------------- */}
      <fieldset>
        <legend>Energy &amp; capability</legend>
        <h3 style={{ marginTop: 0 }}>Energy level on each day</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Meals are matched to each day separately — a low-energy day only gets
          low-effort meals.
        </p>
        <div className="grid-2">
          {DAYS.map((day: Day) => (
            <div className="field" key={day}>
              <label htmlFor={`energy-${day}`}>{DAY_LABELS[day]}</label>
              <select
                id={`energy-${day}`}
                value={prefs.energyByDay[day]}
                onChange={(e) =>
                  setPrefs({
                    energyByDay: {
                      ...prefs.energyByDay,
                      [day]: e.target.value as EnergyLevel,
                    },
                  })
                }
              >
                <option value="low">Low energy</option>
                <option value="medium">Medium energy</option>
                <option value="high">High energy</option>
              </select>
            </div>
          ))}
        </div>

        <h3>Recipe complexity limits</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Leave blank for no limit.
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor={ids.maxSteps}>Most steps per recipe</label>
            <input
              id={ids.maxSteps}
              type="number"
              min={1}
              value={prefs.complexity.maxSteps ?? ""}
              onChange={(e) =>
                setPrefs({
                  complexity: {
                    ...prefs.complexity,
                    maxSteps: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor={ids.maxIngredients}>Most ingredients</label>
            <input
              id={ids.maxIngredients}
              type="number"
              min={1}
              value={prefs.complexity.maxIngredients ?? ""}
              onChange={(e) =>
                setPrefs({
                  complexity: {
                    ...prefs.complexity,
                    maxIngredients: e.target.value
                      ? Number(e.target.value)
                      : null,
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor={ids.maxPans}>Most pans or dishes used</label>
            <input
              id={ids.maxPans}
              type="number"
              min={1}
              value={prefs.complexity.maxPans ?? ""}
              onChange={(e) =>
                setPrefs({
                  complexity: {
                    ...prefs.complexity,
                    maxPans: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
          </div>
        </div>

        <h3 id="equipment-heading">Kitchen equipment you have</h3>
        <div
          className="grid-2"
          role="group"
          aria-labelledby="equipment-heading"
        >
          {EQUIPMENT_OPTIONS.map((eq) => (
            <div className="check-row" key={eq}>
              <input
                type="checkbox"
                id={`eq-${eq}`}
                checked={prefs.equipment.includes(eq)}
                onChange={(e) =>
                  setPrefs({
                    equipment: e.target.checked
                      ? [...prefs.equipment, eq]
                      : prefs.equipment.filter((x) => x !== eq),
                  })
                }
              />
              <label htmlFor={`eq-${eq}`}>{eq}</label>
            </div>
          ))}
        </div>

        <h3>Emergency backup meals</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Two or three zero-effort options (cereal, toast, a sandwich). These
          are always shown, whatever the plan says, and they always count as a
          proper dinner.
        </p>
        <TagListInput
          label="Emergency backup meals"
          values={prefs.emergencyMeals}
          onChange={(v) => setPrefs({ emergencyMeals: v })}
          placeholder="e.g. cereal"
        />
      </fieldset>

      {/* ---------------- Budget ---------------- */}
      <fieldset>
        <legend>Budget</legend>
        <div className="grid-2">
          <div className="field">
            <label htmlFor={ids.weeklyCap}>
              Weekly budget cap (£)
              <span className="label-hint">Leave blank for no cap.</span>
            </label>
            <input
              id={ids.weeklyCap}
              type="number"
              min={0}
              step="0.01"
              value={prefs.budget.weeklyCap ?? ""}
              onChange={(e) =>
                setPrefs({
                  budget: {
                    ...prefs.budget,
                    weeklyCap: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor={ids.perMealCap}>
              Per-meal budget cap (£)
              <span className="label-hint">
                Stops one big spend wrecking the week.
              </span>
            </label>
            <input
              id={ids.perMealCap}
              type="number"
              min={0}
              step="0.01"
              value={prefs.budget.perMealCap ?? ""}
              onChange={(e) =>
                setPrefs({
                  budget: {
                    ...prefs.budget,
                    perMealCap: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
          </div>
        </div>
      </fieldset>

      {/* ---------------- Shopping ---------------- */}
      <fieldset>
        <legend>Shopping</legend>
        <h3 id="supermarkets-heading" style={{ marginTop: 0 }}>
          Supermarkets you use
        </h3>
        <div
          className="grid-2"
          role="group"
          aria-labelledby="supermarkets-heading"
        >
          {UK_SUPERMARKETS.map((s) => (
            <div className="check-row" key={s}>
              <input
                type="checkbox"
                id={`shop-${s}`}
                checked={prefs.shopping.supermarkets.includes(s)}
                onChange={(e) => {
                  const supermarkets = e.target.checked
                    ? [...prefs.shopping.supermarkets, s]
                    : prefs.shopping.supermarkets.filter((x) => x !== s);
                  setPrefs({
                    shopping: {
                      ...prefs.shopping,
                      supermarkets,
                      primarySupermarket: supermarkets.includes(
                        prefs.shopping.primarySupermarket
                      )
                        ? prefs.shopping.primarySupermarket
                        : supermarkets[0] ?? "",
                    },
                  });
                }}
              />
              <label htmlFor={`shop-${s}`}>{s}</label>
            </div>
          ))}
        </div>
        {prefs.shopping.supermarkets.length > 1 && (
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label htmlFor={ids.primarySupermarket}>Main supermarket</label>
            <select
              id={ids.primarySupermarket}
              value={prefs.shopping.primarySupermarket}
              onChange={(e) =>
                setPrefs({
                  shopping: {
                    ...prefs.shopping,
                    primarySupermarket: e.target.value,
                  },
                })
              }
              style={{ maxWidth: "14rem" }}
            >
              {prefs.shopping.supermarkets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ marginTop: "0.75rem" }}>
          <label htmlFor={ids.householdSize}>How many people eat dinner?</label>
          <input
            id={ids.householdSize}
            type="number"
            min={1}
            max={20}
            value={prefs.shopping.householdSize}
            onChange={(e) =>
              setPrefs({
                shopping: {
                  ...prefs.shopping,
                  householdSize: Math.max(1, Number(e.target.value) || 1),
                },
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor={ids.householdNotes}>
            Notes about other people&rsquo;s needs
            <span className="label-hint">
              Optional — e.g. “partner is vegetarian”, “kids eat earlier”.
            </span>
          </label>
          <textarea
            id={ids.householdNotes}
            value={prefs.shopping.householdNotes}
            onChange={(e) =>
              setPrefs({
                shopping: {
                  ...prefs.shopping,
                  householdNotes: e.target.value,
                },
              })
            }
          />
        </div>
      </fieldset>

      {/* ---------------- Medication / appetite (optional) ---------------- */}
      <fieldset>
        <legend>Medication &amp; appetite (optional)</legend>
        <p className="muted" style={{ marginTop: 0 }}>
          Completely optional and only used to time suggestions and reminders
          around low-appetite windows. Skip this section entirely if you
          prefer — nothing else depends on it.
        </p>
        <div className="check-row">
          <input
            type="checkbox"
            id="med-enabled"
            checked={prefs.medication.enabled}
            onChange={(e) =>
              setPrefs({
                medication: { ...prefs.medication, enabled: e.target.checked },
              })
            }
          />
          <label htmlFor="med-enabled">
            My medication affects my appetite
          </label>
        </div>
        {prefs.medication.enabled && (
          <>
            <div className="field" style={{ marginTop: "0.75rem" }}>
              <label htmlFor={ids.medNotes}>
                Notes
                <span className="label-hint">
                  Optional, e.g. “appetite low until early evening”.
                </span>
              </label>
              <textarea
                id={ids.medNotes}
                value={prefs.medication.notes}
                onChange={(e) =>
                  setPrefs({
                    medication: { ...prefs.medication, notes: e.target.value },
                  })
                }
              />
            </div>
            <LowAppetiteWindows
              windows={prefs.medication.lowAppetiteWindows}
              onChange={(w) =>
                setPrefs({
                  medication: { ...prefs.medication, lowAppetiteWindows: w },
                })
              }
            />
          </>
        )}
      </fieldset>

      <p className="notice info" role="status">
        All changes on this page save automatically. There&rsquo;s no submit
        button to find and nothing to lose by leaving the page.
      </p>
    </>
  );
}

function LowAppetiteWindows({
  windows,
  onChange,
}: {
  windows: { start: string; end: string; label?: string }[];
  onChange: (w: { start: string; end: string; label?: string }[]) => void;
}) {
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("17:00");
  const startId = useId();
  const endId = useId();

  return (
    <div className="field">
      <h3>Low-appetite times</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Reminders and suggestions will avoid these windows.
      </p>
      {windows.length > 0 && (
        <ul className="tag-list" aria-label="Low-appetite times">
          {windows.map((w, i) => (
            <li key={`${w.start}-${w.end}-${i}`}>
              <span>
                {w.start}–{w.end}
                {w.label ? ` (${w.label})` : ""}
              </span>
              <button
                type="button"
                aria-label={`Remove low-appetite window ${w.start} to ${w.end}`}
                onClick={() => onChange(windows.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <label htmlFor={startId}>From</label>
          <input
            id={startId}
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={endId}>Until</label>
          <input
            id={endId}
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="secondary small"
          onClick={() => {
            if (start && end) onChange([...windows, { start, end }]);
          }}
        >
          Add window
        </button>
      </div>
    </div>
  );
}
