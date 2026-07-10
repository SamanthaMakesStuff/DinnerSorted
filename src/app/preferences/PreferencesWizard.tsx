"use client";

/**
 * GDS-style ("one thing per page") preferences flow.
 *
 * - Each step asks one or two related questions, with a Back link, a
 *   "Question X of N" indicator, and a Continue button.
 * - The step lives in the URL (?step=slug) so the browser's own back and
 *   forward buttons work, and refreshing keeps your place.
 * - /preferences with no step shows a "check your answers" summary with a
 *   Change link per section (Change → answer → straight back to summary).
 * - Everything still saves automatically the moment it changes — Continue
 *   only moves between pages, it never gates saving.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { TagListInput } from "@/components/TagListInput";
import {
  DAYS,
  DAY_LABELS,
  DIET_TYPES,
  EQUIPMENT_OPTIONS,
  RELIGIOUS_DIET_OPTIONS,
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

const ROTATION_SHORT: Record<RotationSetting, string> = {
  "same-every-week": "Same plan every week",
  rotate: "Rotate through safe meals in order",
  "mostly-safe": "Mostly safe meals, occasional new suggestion",
};

interface StepProps {
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => void;
}

interface StepDef {
  slug: string;
  /** Question-style heading shown as the page h1. */
  title: string;
  /** Short label used on the summary page. */
  summaryLabel: string;
  hint?: string;
  Component: (props: StepProps) => React.ReactNode;
  summaryValue: (prefs: Preferences) => string;
}

/* ------------------------------------------------------------------ steps */

function AllergiesStep({ prefs, setPrefs }: StepProps) {
  const selectId = useId();
  const customId = useId();
  const [pick, setPick] = useState<string>(UK_ALLERGENS[0]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Type or choose an allergen first, then press Add.");
      return;
    }
    if (prefs.allergens.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already on your allergen list.`);
      return;
    }
    setError("");
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
      <p className="muted" style={{ marginTop: 0 }}>
        Anything marked <strong>medical / dangerous</strong> is completely
        excluded from every suggestion — no swaps, no “are you sure”, ever.
        Skip this page if it doesn&rsquo;t apply to you.
      </p>
      <div className="field">
        <label htmlFor={selectId}>Add a standard UK allergen</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select
            id={selectId}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            style={{ maxWidth: "18rem" }}
          >
            {UK_ALLERGENS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="button" className="secondary small" onClick={() => add(pick)}>
            Add allergen
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor={customId}>
          Add another allergen or intolerance
          <span className="label-hint">
            Anything not on the standard list, e.g. kiwi, garlic.
          </span>
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id={customId}
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-describedby={error ? "allergen-error" : undefined}
            aria-invalid={error ? true : undefined}
            style={{ maxWidth: "18rem" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(custom);
                setCustom("");
              }
            }}
          />
          <button
            type="button"
            className="secondary small"
            onClick={() => {
              add(custom);
              setCustom("");
            }}
          >
            Add custom allergen
          </button>
        </div>
        {error && (
          <p className="error-text" id="allergen-error">
            {error}
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
                      onChange={() => updateAllergen(a.name, { severity: "avoid" })}
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
                      onChange={() => updateAllergen(a.name, { severity: "medical" })}
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
                        updateAllergen(a.name, { crossContamination: e.target.checked })
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
                        allergens: prefs.allergens.filter((x) => x.name !== a.name),
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
    </>
  );
}

function DietStep({ prefs, setPrefs }: StepProps) {
  const otherId = useId();
  const standardReligious = prefs.religiousDiet.filter((r) =>
    RELIGIOUS_DIET_OPTIONS.includes(r as (typeof RELIGIOUS_DIET_OPTIONS)[number])
  );
  const customReligious = prefs.religiousDiet.filter(
    (r) => !RELIGIOUS_DIET_OPTIONS.includes(r as (typeof RELIGIOUS_DIET_OPTIONS)[number])
  );
  return (
    <>
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
          <label htmlFor={otherId}>Describe your diet</label>
          <input
            id={otherId}
            type="text"
            value={prefs.dietTypeOther}
            onChange={(e) => setPrefs({ dietTypeOther: e.target.value })}
          />
        </div>
      )}

      <h2 id="religious-heading" style={{ marginTop: "1.5rem" }}>
        Religious or cultural dietary needs
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Tick any that apply — they work alongside your diet type. New-food
        suggestions and quick-add meals respect these; your own safe meals are
        always yours and never filtered.
      </p>
      <div role="group" aria-labelledby="religious-heading">
        {RELIGIOUS_DIET_OPTIONS.map((r) => (
          <div className="check-row" key={r}>
            <input
              type="checkbox"
              id={`rel-${r}`}
              checked={standardReligious.includes(r)}
              onChange={(e) =>
                setPrefs({
                  religiousDiet: e.target.checked
                    ? [...prefs.religiousDiet, r]
                    : prefs.religiousDiet.filter((x) => x !== r),
                })
              }
            />
            <label htmlFor={`rel-${r}`}>{r}</label>
          </div>
        ))}
      </div>
      <TagListInput
        label="Any other religious or cultural needs"
        hint="Optional free text, e.g. Jain (no root vegetables), Ital."
        values={customReligious}
        onChange={(custom) =>
          setPrefs({ religiousDiet: [...standardReligious, ...custom] })
        }
        placeholder="e.g. Jain"
      />
    </>
  );
}

function AvoidStep({ prefs, setPrefs }: StepProps) {
  return (
    <>
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
    </>
  );
}

function TexturesStep({ prefs, setPrefs }: StepProps) {
  return (
    <>
      <TagListInput
        label="Textures to avoid"
        hint="For example: mushy, slimy, mixed textures."
        values={prefs.sensory.textureAvoid}
        onChange={(v) => setPrefs({ sensory: { ...prefs.sensory, textureAvoid: v } })}
        placeholder="e.g. mushy"
      />
      <TagListInput
        label="Textures you prefer"
        hint="For example: crunchy, smooth."
        values={prefs.sensory.texturePrefer}
        onChange={(v) => setPrefs({ sensory: { ...prefs.sensory, texturePrefer: v } })}
        placeholder="e.g. crunchy"
      />
    </>
  );
}

function TemperatureStep({ prefs, setPrefs }: StepProps) {
  const tempId = useId();
  return (
    <div className="field">
      <label htmlFor={tempId}>Meal temperature preference</label>
      <select
        id={tempId}
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
  );
}

function SensesStep({ prefs, setPrefs }: StepProps) {
  const visualId = useId();
  return (
    <>
      <div className="field">
        <label htmlFor={visualId}>
          Visual or colour sensitivities
          <span className="label-hint">
            For example: no sauces that change the colour of food. Leave blank
            if none.
          </span>
        </label>
        <textarea
          id={visualId}
          value={prefs.sensory.visualNotes}
          onChange={(e) =>
            setPrefs({ sensory: { ...prefs.sensory, visualNotes: e.target.value } })
          }
        />
      </div>
      <div className="check-row">
        <input
          type="checkbox"
          id="smell-sensitive"
          checked={prefs.sensory.smellSensitive}
          onChange={(e) =>
            setPrefs({ sensory: { ...prefs.sensory, smellSensitive: e.target.checked } })
          }
        />
        <label htmlFor="smell-sensitive">
          I&rsquo;m sensitive to strong cooking smells
          <span className="label-hint">
            Meals tagged “strong smell” will be hidden by default.
          </span>
        </label>
      </div>
    </>
  );
}

function EnergyStep({ prefs, setPrefs }: StepProps) {
  const allId = useId();
  const [announce, setAnnounce] = useState("");
  const levels = Object.values(prefs.energyByDay);
  const allSame = levels.every((l) => l === levels[0]);
  const daysDiffer = !allSame;

  function setAllDays(level: EnergyLevel) {
    setPrefs({
      energyByDay: {
        monday: level,
        tuesday: level,
        wednesday: level,
        thursday: level,
        friday: level,
        saturday: level,
        sunday: level,
      },
    });
    setAnnounce(`Every day set to ${level} energy.`);
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Meals are matched to each day separately — a low-energy day only gets
        low-effort meals. One answer covers the whole week; only open the
        day-by-day part if your week genuinely varies.
      </p>
      <div className="field">
        <label htmlFor={allId}>Set every day at once</label>
        <select
          id={allId}
          value={allSame ? levels[0] : ""}
          onChange={(e) => {
            if (e.target.value) setAllDays(e.target.value as EnergyLevel);
          }}
          style={{ maxWidth: "16rem" }}
        >
          {!allSame && <option value="">Days are set individually…</option>}
          <option value="low">Low energy every day</option>
          <option value="medium">Medium energy every day</option>
          <option value="high">High energy every day</option>
        </select>
      </div>
      <p aria-live="polite" className="visually-hidden">
        {announce}
      </p>

      <details open={daysDiffer}>
        <summary>Adjust individual days (optional)</summary>
        <div className="grid-2" style={{ marginTop: "0.75rem" }}>
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
      </details>
    </>
  );
}

function ComplexityStep({ prefs, setPrefs }: StepProps) {
  const stepsId = useId();
  const ingId = useId();
  const pansId = useId();
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Leave any of these blank for no limit.
      </p>
      <div className="grid-2">
        <div className="field">
          <label htmlFor={stepsId}>Most steps per recipe</label>
          <input
            id={stepsId}
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
          <label htmlFor={ingId}>Most ingredients</label>
          <input
            id={ingId}
            type="number"
            min={1}
            value={prefs.complexity.maxIngredients ?? ""}
            onChange={(e) =>
              setPrefs({
                complexity: {
                  ...prefs.complexity,
                  maxIngredients: e.target.value ? Number(e.target.value) : null,
                },
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor={pansId}>Most pans or dishes used</label>
          <input
            id={pansId}
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
    </>
  );
}

function EquipmentStep({ prefs, setPrefs }: StepProps) {
  return (
    <div className="grid-2" role="group" aria-label="Kitchen equipment you have">
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
  );
}

function EmergencyStep({ prefs, setPrefs }: StepProps) {
  return (
    <>
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
    </>
  );
}

function BudgetStep({ prefs, setPrefs }: StepProps) {
  const weeklyId = useId();
  const mealId = useId();
  return (
    <div className="grid-2">
      <div className="field">
        <label htmlFor={weeklyId}>
          Weekly budget cap (£)
          <span className="label-hint">Leave blank for no cap.</span>
        </label>
        <input
          id={weeklyId}
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
        <label htmlFor={mealId}>
          Per-meal budget cap (£)
          <span className="label-hint">Stops one big spend wrecking the week.</span>
        </label>
        <input
          id={mealId}
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
  );
}

function ShopsStep({ prefs, setPrefs }: StepProps) {
  const primaryId = useId();
  return (
    <>
      <div className="grid-2" role="group" aria-label="Supermarkets you use">
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
          <label htmlFor={primaryId}>Main supermarket</label>
          <select
            id={primaryId}
            value={prefs.shopping.primarySupermarket}
            onChange={(e) =>
              setPrefs({
                shopping: { ...prefs.shopping, primarySupermarket: e.target.value },
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
    </>
  );
}

function HouseholdStep({ prefs, setPrefs }: StepProps) {
  const sizeId = useId();
  const notesId = useId();
  return (
    <>
      <div className="field">
        <label htmlFor={sizeId}>How many people eat dinner?</label>
        <input
          id={sizeId}
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
        <label htmlFor={notesId}>
          Notes about other people&rsquo;s needs
          <span className="label-hint">
            Optional — e.g. “partner is vegetarian”, “kids eat earlier”.
          </span>
        </label>
        <textarea
          id={notesId}
          value={prefs.shopping.householdNotes}
          onChange={(e) =>
            setPrefs({
              shopping: { ...prefs.shopping, householdNotes: e.target.value },
            })
          }
        />
      </div>
    </>
  );
}

function MedicationStep({ prefs, setPrefs }: StepProps) {
  const notesId = useId();
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Completely optional and only used to time suggestions around
        low-appetite windows. Skip this page freely — nothing else depends on
        it.
      </p>
      <div className="check-row">
        <input
          type="checkbox"
          id="med-enabled"
          checked={prefs.medication.enabled}
          onChange={(e) =>
            setPrefs({ medication: { ...prefs.medication, enabled: e.target.checked } })
          }
        />
        <label htmlFor="med-enabled">My medication affects my appetite</label>
      </div>
      {prefs.medication.enabled && (
        <>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label htmlFor={notesId}>
              Notes
              <span className="label-hint">
                Optional, e.g. “appetite low until early evening”.
              </span>
            </label>
            <textarea
              id={notesId}
              value={prefs.medication.notes}
              onChange={(e) =>
                setPrefs({ medication: { ...prefs.medication, notes: e.target.value } })
              }
            />
          </div>
          <LowAppetiteWindows
            windows={prefs.medication.lowAppetiteWindows}
            onChange={(w) =>
              setPrefs({ medication: { ...prefs.medication, lowAppetiteWindows: w } })
            }
          />
        </>
      )}
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
      <h2>Low-appetite times</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Suggestions will avoid these windows.
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
          <input id={startId} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor={endId}>Until</label>
          <input id={endId} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
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

function RepetitionStep({ prefs, setPrefs }: StepProps) {
  return (
    <>
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
        <span className="label-hint">A small fixed number, so choosing stays easy.</span>
        <div role="radiogroup" aria-labelledby="options-per-slot-label" style={{ marginTop: "0.4rem" }}>
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
    </>
  );
}

/* --------------------------------------------------------- step registry */

const none = "Not set";
const listOrNone = (xs: string[], noneText = "None added") =>
  xs.length ? xs.join(", ") : noneText;

const STEPS: StepDef[] = [
  {
    slug: "allergies",
    title: "Do you have any allergies or intolerances?",
    summaryLabel: "Allergies & intolerances",
    Component: AllergiesStep,
    summaryValue: (p) =>
      p.allergens.length
        ? p.allergens
            .map(
              (a) =>
                `${a.name} (${a.severity === "medical" ? "medical" : "avoid"}${
                  a.crossContamination ? ", incl. traces" : ""
                })`
            )
            .join("; ")
        : "None added",
  },
  {
    slug: "diet",
    title: "What do you eat?",
    summaryLabel: "Diet type",
    Component: DietStep,
    summaryValue: (p) => {
      const base =
        p.dietType === "other" && p.dietTypeOther
          ? `Other — ${p.dietTypeOther}`
          : DIET_LABELS[p.dietType];
      return p.religiousDiet.length
        ? `${base} · ${p.religiousDiet.join(", ")}`
        : base;
    },
  },
  {
    slug: "avoid",
    title: "Any foods or flavours to avoid?",
    summaryLabel: "Foods to avoid",
    Component: AvoidStep,
    summaryValue: (p) => listOrNone(p.avoidFoods),
  },
  {
    slug: "textures",
    title: "How do you feel about textures?",
    summaryLabel: "Textures",
    Component: TexturesStep,
    summaryValue: (p) => {
      const parts = [];
      if (p.sensory.textureAvoid.length)
        parts.push(`Avoid: ${p.sensory.textureAvoid.join(", ")}`);
      if (p.sensory.texturePrefer.length)
        parts.push(`Prefer: ${p.sensory.texturePrefer.join(", ")}`);
      return parts.length ? parts.join(" · ") : "No texture preferences";
    },
  },
  {
    slug: "temperature",
    title: "What temperature do you like meals?",
    summaryLabel: "Meal temperature",
    Component: TemperatureStep,
    summaryValue: (p) =>
      ({
        any: "No preference",
        hot: "Hot meals",
        cold: "Cold meals",
        room: "Room temperature",
      })[p.sensory.temperature],
  },
  {
    slug: "senses",
    title: "Sight and smell sensitivities",
    summaryLabel: "Sight & smell",
    Component: SensesStep,
    summaryValue: (p) => {
      const parts = [];
      if (p.sensory.visualNotes.trim()) parts.push("Visual notes added");
      parts.push(
        p.sensory.smellSensitive ? "Sensitive to strong smells" : "No smell sensitivity"
      );
      return parts.join(" · ");
    },
  },
  {
    slug: "energy",
    title: "How much energy do you usually have each day?",
    summaryLabel: "Energy by day",
    Component: EnergyStep,
    summaryValue: (p) => {
      const levels = Object.values(p.energyByDay);
      if (levels.every((l) => l === levels[0]))
        return `${levels[0][0].toUpperCase()}${levels[0].slice(1)} energy every day`;
      return DAYS.map((d) => `${DAY_LABELS[d].slice(0, 3)} ${p.energyByDay[d]}`).join(", ");
    },
  },
  {
    slug: "complexity",
    title: "How complicated can recipes be?",
    summaryLabel: "Recipe complexity limits",
    Component: ComplexityStep,
    summaryValue: (p) => {
      const parts = [];
      if (p.complexity.maxSteps != null) parts.push(`≤${p.complexity.maxSteps} steps`);
      if (p.complexity.maxIngredients != null)
        parts.push(`≤${p.complexity.maxIngredients} ingredients`);
      if (p.complexity.maxPans != null) parts.push(`≤${p.complexity.maxPans} pans`);
      return parts.length ? parts.join(" · ") : "No limits";
    },
  },
  {
    slug: "equipment",
    title: "What kitchen equipment do you have?",
    summaryLabel: "Kitchen equipment",
    Component: EquipmentStep,
    summaryValue: (p) => listOrNone(p.equipment, none),
  },
  {
    slug: "emergency",
    title: "Your emergency backup meals",
    summaryLabel: "Emergency backup meals",
    Component: EmergencyStep,
    summaryValue: (p) => listOrNone(p.emergencyMeals),
  },
  {
    slug: "budget",
    title: "Do you have a food budget?",
    summaryLabel: "Budget",
    Component: BudgetStep,
    summaryValue: (p) => {
      const parts = [];
      if (p.budget.weeklyCap != null) parts.push(`£${p.budget.weeklyCap} a week`);
      if (p.budget.perMealCap != null) parts.push(`£${p.budget.perMealCap} a meal`);
      return parts.length ? parts.join(" · ") : "No budget caps";
    },
  },
  {
    slug: "shops",
    title: "Where do you shop?",
    summaryLabel: "Supermarkets",
    Component: ShopsStep,
    summaryValue: (p) =>
      p.shopping.supermarkets.length
        ? p.shopping.supermarkets
            .map((s) => (s === p.shopping.primarySupermarket ? `${s} (main)` : s))
            .join(", ")
        : "None chosen",
  },
  {
    slug: "household",
    title: "Who are you cooking for?",
    summaryLabel: "Household",
    Component: HouseholdStep,
    summaryValue: (p) =>
      `${p.shopping.householdSize} ${p.shopping.householdSize === 1 ? "person" : "people"}${
        p.shopping.householdNotes.trim() ? " · notes added" : ""
      }`,
  },
  {
    slug: "medication",
    title: "Medication and appetite (optional)",
    summaryLabel: "Medication & appetite",
    Component: MedicationStep,
    summaryValue: (p) =>
      p.medication.enabled
        ? `Yes${
            p.medication.lowAppetiteWindows.length
              ? ` · ${p.medication.lowAppetiteWindows.length} low-appetite window${
                  p.medication.lowAppetiteWindows.length === 1 ? "" : "s"
                }`
              : ""
          }`
        : "Skipped (optional)",
  },
  {
    slug: "repetition",
    title: "How should your meals repeat?",
    summaryLabel: "Repetition & new foods",
    Component: RepetitionStep,
    summaryValue: (p) =>
      `${ROTATION_SHORT[p.rotation]} · new foods ${p.newFoodsOptIn ? "on" : "off"} · ${
        p.optionsPerSlot
      } choices a day`,
  },
];

/* ---------------------------------------------------------------- wizard */

export function PreferencesWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, update, ready, syncState } = useStore();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stepSlug = searchParams.get("step");
  const fromSummary = searchParams.get("from") === "summary";
  const stepIndex = STEPS.findIndex((s) => s.slug === stepSlug);
  const step = stepIndex >= 0 ? STEPS[stepIndex] : null;

  // Move focus to the page heading whenever the step changes, so keyboard
  // and screen-reader users land at the new question, GDS-style.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepSlug]);

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  const prefs = data.preferences;
  const setPrefs = (patch: Partial<Preferences>) =>
    update((d) => ({ ...d, preferences: { ...d.preferences, ...patch } }));

  /* ------------------------------------------------ summary (no ?step=) */
  if (!step) {
    return (
      <>
        <h1 tabIndex={-1} ref={headingRef}>
          Your preferences
        </h1>
        <p className="lede">
          One question at a time — go through from the start, or jump straight
          to anything you want to change. Everything saves automatically
          {syncState === "guest" ? " (to this browser tab)" : ""}.
        </p>
        <div className="button-row">
          <Link className="button" href="/preferences?step=allergies">
            Go through the questions from the start
          </Link>
        </div>

        <h2>Check your answers</h2>
        <dl className="summary-list">
          {STEPS.map((s) => (
            <div className="summary-row" key={s.slug}>
              <dt>{s.summaryLabel}</dt>
              <dd>{s.summaryValue(prefs)}</dd>
              <dd className="summary-action">
                <Link href={`/preferences?step=${s.slug}&from=summary`}>
                  Change
                  <span className="visually-hidden"> {s.summaryLabel}</span>
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </>
    );
  }

  /* ------------------------------------------------------- a single step */
  const prevStep = stepIndex > 0 ? STEPS[stepIndex - 1] : null;
  const nextStep = stepIndex < STEPS.length - 1 ? STEPS[stepIndex + 1] : null;

  const backHref = fromSummary
    ? "/preferences"
    : prevStep
      ? `/preferences?step=${prevStep.slug}`
      : "/preferences";
  const continueHref = fromSummary
    ? "/preferences"
    : nextStep
      ? `/preferences?step=${nextStep.slug}`
      : "/preferences";

  const StepBody = step.Component;

  return (
    <>
      <Link className="back-link" href={backHref}>
        Back
      </Link>
      <p className="step-progress">
        Question {stepIndex + 1} of {STEPS.length}
      </p>
      <h1 tabIndex={-1} ref={headingRef}>
        {step.title}
      </h1>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          router.push(continueHref);
        }}
      >
        <StepBody prefs={prefs} setPrefs={setPrefs} />
        <div className="button-row" style={{ marginTop: "1.5rem" }}>
          <button type="submit">
            {fromSummary
              ? "Save and go back to your answers"
              : nextStep
                ? "Continue"
                : "Finish and check your answers"}
          </button>
          {!fromSummary && (
            <Link href="/preferences" className="button secondary">
              Skip to all your answers
            </Link>
          )}
        </div>
      </form>
      <p className="muted">
        Your answer saves the moment you change it — Continue just moves to
        the next question, and nothing is lost if you leave.
      </p>
    </>
  );
}
