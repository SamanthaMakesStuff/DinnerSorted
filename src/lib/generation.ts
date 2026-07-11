/**
 * Weekly menu generation — deterministic, rule-based, never surprising.
 *
 * Implements the Section 4 rules of thumb:
 *  1. New (non-safe) foods only when the user opted in.
 *  2. Each day matched to that day's energy level.
 *  3. Medical allergies are hard exclusions — the meal is simply excluded,
 *     never offered with a swap.
 *  4. Preference-level dislikes/sensory aversions excluded by default, with a
 *     visible "show anyway" override so the system never feels opaque.
 *  5. Rotation is user-controlled; nothing is shuffled unless the user asks
 *     ("surprise me" passes an explicit seed).
 *  6. Fixed small number of options per slot (2–3).
 *  7. Budget checked at the weekly-total level, warning before overspend.
 */
import type {
  Day,
  EnergyLevel,
  FreezerItem,
  PlanSlot,
  Preferences,
  SafeMeal,
  UserData,
  WeekPlan,
} from "./types";
import { DAYS, DAY_LABELS } from "./types";
import { makeId } from "./defaults";
import {
  STARTER_MEALS,
  starterMealFitsDiet,
  starterMealFitsReligiousDiet,
} from "./starter-meals";

export type ExclusionReason =
  | { kind: "medical-allergy"; allergen: string }
  | { kind: "trace-allergy"; allergen: string }
  | { kind: "avoid-allergy"; allergen: string }
  | { kind: "avoid-food"; term: string }
  | { kind: "texture"; term: string }
  | { kind: "temperature" }
  | { kind: "smell" }
  | { kind: "equipment"; missing: string[] }
  | { kind: "complexity"; detail: string }
  | { kind: "per-meal-budget" }
  | { kind: "new-food" };

export interface ExcludedMeal {
  meal: SafeMeal;
  reasons: ExclusionReason[];
  /**
   * Preference-level exclusions can be overridden ("show anyway").
   * Medical allergies and missing equipment can not.
   */
  overridable: boolean;
}

export interface MealPool {
  eligible: SafeMeal[];
  excluded: ExcludedMeal[];
}

const ENERGY_RANK: Record<EnergyLevel, number> = { low: 0, medium: 1, high: 2 };

export function reasonLabel(r: ExclusionReason): string {
  switch (r.kind) {
    case "medical-allergy":
      return `contains ${r.allergen} (medical allergy — always excluded)`;
    case "trace-allergy":
      return `may contain traces of ${r.allergen} (cross-contamination risk)`;
    case "avoid-allergy":
      return `contains ${r.allergen} (on your avoid list)`;
    case "avoid-food":
      return `matches “${r.term}” on your foods-to-avoid list`;
    case "texture":
      return `texture “${r.term}” is on your avoid list`;
    case "temperature":
      return "doesn't match your temperature preference";
    case "smell":
      return "tagged as strong-smelling and you've set smell sensitivity";
    case "equipment":
      return `needs equipment you don't have: ${r.missing.join(", ")}`;
    case "complexity":
      return r.detail;
    case "per-meal-budget":
      return "estimated cost is over your per-meal budget cap";
    case "new-food":
      return "marked as a new/unfamiliar food and new foods are switched off";
  }
}

function matchesTerm(meal: SafeMeal, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const haystacks = [
    meal.name,
    ...meal.tags,
    ...meal.ingredients.map((i) => i.name),
  ].map((s) => s.toLowerCase());
  return haystacks.some((h) => h.includes(t));
}

function mealCost(meal: SafeMeal): number | null {
  if (meal.estCost != null) return meal.estCost;
  const costs = meal.ingredients
    .map((i) => i.estCost)
    .filter((c): c is number => c != null);
  if (costs.length === 0) return null;
  return costs.reduce((a, b) => a + b, 0);
}

/**
 * Split the user's meals into eligible vs excluded (with reasons).
 * `includeOverridable` re-admits preference-level exclusions ("show anyway").
 */
export function buildMealPool(
  prefs: Preferences,
  meals: SafeMeal[],
  opts: { includeOverridable?: boolean } = {}
): MealPool {
  const eligible: SafeMeal[] = [];
  const excluded: ExcludedMeal[] = [];

  for (const meal of meals) {
    const hard: ExclusionReason[] = [];
    const soft: ExclusionReason[] = [];

    for (const a of prefs.allergens) {
      const has = meal.allergens.some(
        (x) => x.toLowerCase() === a.name.toLowerCase()
      );
      const trace = meal.traceAllergens.some(
        (x) => x.toLowerCase() === a.name.toLowerCase()
      );
      if (a.severity === "medical") {
        // Rule 3: hard exclusion, no substitutions, no override.
        if (has) hard.push({ kind: "medical-allergy", allergen: a.name });
        else if (trace && a.crossContamination)
          hard.push({ kind: "trace-allergy", allergen: a.name });
      } else if (has || (trace && a.crossContamination)) {
        soft.push({ kind: "avoid-allergy", allergen: a.name });
      }
    }

    // Equipment the user doesn't have is a hard practical limit.
    const missing = meal.equipment.filter(
      (e) => !prefs.equipment.some((have) => have.toLowerCase() === e.toLowerCase())
    );
    if (missing.length > 0) hard.push({ kind: "equipment", missing });

    // New/unfamiliar meals only when opted in (rule 1).
    if (meal.isNew && !prefs.newFoodsOptIn) hard.push({ kind: "new-food" });

    for (const term of prefs.avoidFoods) {
      if (matchesTerm(meal, term)) soft.push({ kind: "avoid-food", term });
    }
    for (const term of prefs.sensory.textureAvoid) {
      if (meal.tags.some((tag) => tag.toLowerCase().includes(term.trim().toLowerCase())))
        soft.push({ kind: "texture", term });
    }
    if (
      prefs.sensory.temperature !== "any" &&
      meal.temperature !== "any" &&
      meal.temperature !== prefs.sensory.temperature
    ) {
      soft.push({ kind: "temperature" });
    }
    if (
      prefs.sensory.smellSensitive &&
      meal.tags.some((t) => t.toLowerCase().includes("strong smell"))
    ) {
      soft.push({ kind: "smell" });
    }

    const c = prefs.complexity;
    if (c.maxSteps != null && meal.steps != null && meal.steps > c.maxSteps)
      soft.push({ kind: "complexity", detail: `has ${meal.steps} steps (your limit is ${c.maxSteps})` });
    if (
      c.maxIngredients != null &&
      meal.ingredients.length > c.maxIngredients
    )
      soft.push({
        kind: "complexity",
        detail: `has ${meal.ingredients.length} ingredients (your limit is ${c.maxIngredients})`,
      });
    if (c.maxPans != null && meal.pans != null && meal.pans > c.maxPans)
      soft.push({ kind: "complexity", detail: `uses ${meal.pans} pans (your limit is ${c.maxPans})` });

    const cost = mealCost(meal);
    if (
      prefs.budget.perMealCap != null &&
      cost != null &&
      cost > prefs.budget.perMealCap
    )
      soft.push({ kind: "per-meal-budget" });

    if (hard.length > 0) {
      excluded.push({ meal, reasons: [...hard, ...soft], overridable: false });
    } else if (soft.length > 0 && !opts.includeOverridable) {
      excluded.push({ meal, reasons: soft, overridable: true });
    } else {
      eligible.push(meal);
    }
  }

  return { eligible, excluded };
}

/** Meals whose effort fits the day's energy (low energy day → low effort only). */
function fitsEnergy(meal: SafeMeal, dayEnergy: EnergyLevel): boolean {
  return ENERGY_RANK[meal.effort] <= ENERGY_RANK[dayEnergy];
}

/** Deterministic string hash for "surprise me" seeding. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface GenerateOptions {
  /** Include preference-level-excluded meals ("show anyway"). */
  includeOverridable?: boolean;
  /**
   * Explicit "surprise me" seed. Absent = fully deterministic order
   * (rotation continues from history; no shuffling — rule 5).
   */
  surpriseSeed?: string;
  /**
   * Supermarket catalogue meals (already converted to SafeMeal shape with
   * isNew: true). When present and the user has opted in to new foods,
   * these are the preferred source of the occasional new suggestion —
   * a real ready meal from their supermarket instead of a generic recipe.
   */
  catalogue?: SafeMeal[];
}

export interface GenerateResult {
  plan: WeekPlan;
  pool: MealPool;
  /** Plain-language issues, e.g. days with no matching meal. */
  warnings: string[];
}

/**
 * Generate a week plan from the user's data.
 * Deterministic given the same inputs unless surpriseSeed is passed.
 */
export function generateWeekPlan(
  data: UserData,
  opts: GenerateOptions = {}
): GenerateResult {
  const prefs = data.preferences;
  const pool = buildMealPool(prefs, data.safeMeals, {
    includeOverridable: opts.includeOverridable,
  });
  const warnings: string[] = [];

  // Optional single new-food suggestion from the starter library (rule 1 +
  // "mostly-safe" rotation). Never replaces a safe option; appended as an
  // extra clearly-labelled choice.
  let newSuggestion: SafeMeal | null = null;
  if (prefs.newFoodsOptIn && prefs.rotation === "mostly-safe") {
    const ownNames = new Set(data.safeMeals.map((m) => m.name.toLowerCase()));
    // Prefer real supermarket meals from the catalogue when available;
    // fall back to the built-in starter library.
    const catalogueCandidates = (opts.catalogue ?? []).filter(
      (m) => !ownNames.has(m.name.toLowerCase())
    );
    const starterCandidates = STARTER_MEALS.filter(
      (m) =>
        !ownNames.has(m.name.toLowerCase()) &&
        starterMealFitsDiet(m, prefs.dietType) &&
        starterMealFitsReligiousDiet(m, prefs.religiousDiet)
    ).map((m) => ({ ...m, id: `new_${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, isNew: true }));
    const candidates =
      catalogueCandidates.length > 0 ? catalogueCandidates : starterCandidates;
    // Vet against every safety rule; the pool must allow isNew here, so we
    // vet with newFoodsOptIn already true (it is — we're inside the gate).
    const vetted = buildMealPool(prefs, candidates, {}).eligible.filter(
      // A brand-new food should never be a high-effort gamble.
      (m) => m.effort === "low"
    );
    if (vetted.length > 0) {
      // Deterministic pick that advances week by week.
      const week = data.planHistory.length;
      newSuggestion = vetted[week % vetted.length];
    }
  }

  // Freezer stock: meals with portions available can be offered as
  // zero-shopping options.
  const freezerByMealId = new Map<string, FreezerItem>();
  for (const item of data.freezer) {
    if (item.mealId && item.portions > 0) freezerByMealId.set(item.mealId, item);
  }

  const lastPlan = data.planHistory[0] ?? null;
  const usage = new Map<string, number>(); // meal id -> times offered this week

  // Rotation memory: how far through the pool previous weeks got.
  const rotationOffset =
    prefs.rotation === "rotate" ? data.planHistory.length * DAYS.length : 0;

  const surprise = opts.surpriseSeed != null;
  const orderedPool = [...pool.eligible].sort((a, b) => {
    if (surprise) {
      return hash(a.id + opts.surpriseSeed!) - hash(b.id + opts.surpriseSeed!);
    }
    return a.name.localeCompare(b.name); // stable, predictable order
  });

  const optionsPerSlot = prefs.optionsPerSlot;
  const slots: PlanSlot[] = [];

  DAYS.forEach((day, dayIndex) => {
    const energy = prefs.energyByDay[day];
    const candidates = orderedPool.filter((m) => fitsEnergy(m, energy));

    const optionIds: string[] = [];
    const freezerOptionIds: string[] = [];
    let note: string | null = null;

    // 1) A meal pinned to this day always leads.
    const pinned = candidates.filter((m) => m.fixedDay === day);
    for (const m of pinned) {
      if (optionIds.length < optionsPerSlot) optionIds.push(m.id);
    }

    // 2) "Same every week": repeat last week's options for this day.
    if (prefs.rotation === "same-every-week" && lastPlan) {
      const lastSlot = lastPlan.slots.find((s) => s.day === day);
      if (lastSlot) {
        const preferredOrder = [
          ...(lastSlot.chosenId ? [lastSlot.chosenId] : []),
          ...lastSlot.optionIds,
        ];
        for (const id of preferredOrder) {
          if (optionIds.length >= optionsPerSlot) break;
          if (optionIds.includes(id)) continue;
          if (candidates.some((m) => m.id === id)) optionIds.push(id);
        }
      }
    }

    // 3) Fill remaining option slots from the pool, spreading meals across
    //    the week (least-used first) and honouring rotation offset.
    const unpinned = candidates.filter((m) => m.fixedDay == null || m.fixedDay === day);
    const rotated = unpinned.length
      ? unpinned
          .slice((rotationOffset + dayIndex) % unpinned.length)
          .concat(unpinned.slice(0, (rotationOffset + dayIndex) % unpinned.length))
      : [];
    const byUsage = [...rotated].sort(
      (a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0)
    );
    for (const m of byUsage) {
      if (optionIds.length >= optionsPerSlot) break;
      if (!optionIds.includes(m.id)) optionIds.push(m.id);
    }

    // 4) Occasional new-food suggestion: one extra, clearly-flagged option on
    //    the user's highest-energy day only.
    if (
      newSuggestion &&
      dayIndex ===
        DAYS.reduce(
          (best, d, i) =>
            ENERGY_RANK[prefs.energyByDay[d]] >
            ENERGY_RANK[prefs.energyByDay[DAYS[best]]]
              ? i
              : best,
          0
        )
    ) {
      optionIds.push(newSuggestion.id);
    }

    for (const id of optionIds) {
      usage.set(id, (usage.get(id) ?? 0) + 1);
      if (freezerByMealId.has(id)) freezerOptionIds.push(id);
    }

    if (optionIds.length === 0) {
      note =
        energy === "low"
          ? `No low-effort meals match your filters for ${DAY_LABELS[day]}. Your emergency backup meals are always fine.`
          : `No meals match your filters for ${DAY_LABELS[day]}.`;
      warnings.push(note);
    }

    slots.push({
      day,
      optionIds,
      chosenId: optionIds[0] ?? null,
      freezerOptionIds,
      note,
    });
  });

  // Rule 7: weekly budget check with a warning up front.
  const allMeals = new Map<string, SafeMeal>(
    [...data.safeMeals, ...(newSuggestion ? [newSuggestion] : [])].map((m) => [m.id, m])
  );
  let estTotal: number | null = 0;
  for (const slot of slots) {
    const chosen = slot.chosenId ? allMeals.get(slot.chosenId) : undefined;
    if (!chosen) continue;
    if (slot.freezerOptionIds.includes(chosen.id)) continue; // no shopping cost
    const cost = mealCost(chosen);
    if (cost == null) {
      estTotal = null; // unknown costs → no misleading total
      break;
    }
    estTotal += cost * Math.max(1, prefs.shopping.householdSize);
  }

  let budgetWarning: string | null = null;
  if (
    estTotal != null &&
    prefs.budget.weeklyCap != null &&
    estTotal > prefs.budget.weeklyCap
  ) {
    budgetWarning = `Estimated week total £${estTotal.toFixed(2)} is over your weekly budget of £${prefs.budget.weeklyCap.toFixed(2)}. Swapping some options for cheaper meals will bring it down.`;
    warnings.push(budgetWarning);
  }

  // Embed any suggested non-safe-list meal so the plan is self-contained
  // (home page, shopping list and history can resolve it without the
  // catalogue being reachable).
  const offeredIds = new Set(slots.flatMap((s) => s.optionIds));
  const extraMeals =
    newSuggestion && offeredIds.has(newSuggestion.id) ? [newSuggestion] : [];

  const plan: WeekPlan = {
    id: makeId("plan"),
    createdAt: new Date().toISOString(),
    label: `Week of ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`,
    slots,
    estTotal,
    budgetWarning,
    extraMeals,
  };

  return { plan, pool, warnings };
}

/** The extra new-food meal (if any) referenced by a plan but not in safeMeals. */
export function resolvePlanMeal(
  data: UserData,
  mealId: string
): SafeMeal | null {
  const own = data.safeMeals.find((m) => m.id === mealId);
  if (own) return own;
  // Meals embedded in a plan (catalogue/new-food suggestions).
  for (const plan of data.planHistory) {
    const extra = (plan.extraMeals ?? []).find((m) => m.id === mealId);
    if (extra) return extra;
  }
  if (mealId.startsWith("new_")) {
    const starter = STARTER_MEALS.find(
      (m) => `new_${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` === mealId
    );
    if (starter) return { ...starter, id: mealId, isNew: true };
  }
  return null;
}
