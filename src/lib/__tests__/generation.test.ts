import { describe, expect, it } from "vitest";
import { buildMealPool, generateWeekPlan } from "../generation";
import { defaultUserData } from "../defaults";
import type { SafeMeal, UserData } from "../types";

let n = 0;
function meal(patch: Partial<SafeMeal> & { name: string }): SafeMeal {
  n += 1;
  return {
    id: `m${n}`,
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
    ...patch,
  };
}

function baseData(meals: SafeMeal[]): UserData {
  const d = defaultUserData();
  return { ...d, safeMeals: meals };
}

describe("buildMealPool — allergy handling", () => {
  it("hard-excludes medical allergens with no override", () => {
    const d = baseData([meal({ name: "Peanut stew", allergens: ["Peanuts"] })]);
    d.preferences.allergens = [
      { name: "Peanuts", severity: "medical", crossContamination: false },
    ];
    const pool = buildMealPool(d.preferences, d.safeMeals, {
      includeOverridable: true, // even with "show anyway"
    });
    expect(pool.eligible).toHaveLength(0);
    expect(pool.excluded[0].overridable).toBe(false);
  });

  it("excludes trace contamination only when the flag is set", () => {
    const meals = [meal({ name: "Pesto pasta", traceAllergens: ["Tree nuts"] })];
    const d = baseData(meals);
    d.preferences.allergens = [
      { name: "Tree nuts", severity: "medical", crossContamination: false },
    ];
    expect(buildMealPool(d.preferences, d.safeMeals).eligible).toHaveLength(1);

    d.preferences.allergens[0].crossContamination = true;
    expect(buildMealPool(d.preferences, d.safeMeals).eligible).toHaveLength(0);
  });

  it("treats avoid-level allergens as overridable", () => {
    const d = baseData([meal({ name: "Omelette", allergens: ["Eggs"] })]);
    d.preferences.allergens = [
      { name: "Eggs", severity: "avoid", crossContamination: false },
    ];
    const hidden = buildMealPool(d.preferences, d.safeMeals);
    expect(hidden.eligible).toHaveLength(0);
    expect(hidden.excluded[0].overridable).toBe(true);

    const shown = buildMealPool(d.preferences, d.safeMeals, {
      includeOverridable: true,
    });
    expect(shown.eligible).toHaveLength(1);
  });
});

describe("buildMealPool — preference filters", () => {
  it("excludes avoid-foods by name, tag and ingredient", () => {
    const d = baseData([
      meal({ name: "Mushroom risotto" }),
      meal({
        name: "Stew",
        ingredients: [
          { name: "Mushrooms", category: "Fruit & vegetables", quantity: "", estCost: null },
        ],
      }),
      meal({ name: "Plain pasta" }),
    ]);
    d.preferences.avoidFoods = ["mushroom"];
    const pool = buildMealPool(d.preferences, d.safeMeals);
    expect(pool.eligible.map((m) => m.name)).toEqual(["Plain pasta"]);
  });

  it("excludes new foods unless opted in", () => {
    const d = baseData([meal({ name: "New thing", isNew: true })]);
    expect(buildMealPool(d.preferences, d.safeMeals).eligible).toHaveLength(0);
    // new-food exclusion is not overridable via "show anyway"
    expect(
      buildMealPool(d.preferences, d.safeMeals, { includeOverridable: true })
        .eligible
    ).toHaveLength(0);
    d.preferences.newFoodsOptIn = true;
    expect(buildMealPool(d.preferences, d.safeMeals).eligible).toHaveLength(1);
  });

  it("excludes meals needing equipment the user lacks (not overridable)", () => {
    const d = baseData([meal({ name: "Air-fried thing", equipment: ["Air fryer"] })]);
    d.preferences.equipment = ["Microwave"];
    const pool = buildMealPool(d.preferences, d.safeMeals, {
      includeOverridable: true,
    });
    expect(pool.eligible).toHaveLength(0);
    expect(pool.excluded[0].overridable).toBe(false);
  });

  it("applies complexity limits as overridable exclusions", () => {
    const d = baseData([meal({ name: "Fiddly", steps: 12 })]);
    d.preferences.complexity.maxSteps = 5;
    expect(buildMealPool(d.preferences, d.safeMeals).eligible).toHaveLength(0);
    expect(
      buildMealPool(d.preferences, d.safeMeals, { includeOverridable: true })
        .eligible
    ).toHaveLength(1);
  });
});

describe("generateWeekPlan", () => {
  it("matches meals to each day's energy level", () => {
    const d = baseData([
      meal({ name: "Easy", effort: "low" }),
      meal({ name: "Hard", effort: "high" }),
    ]);
    d.preferences.energyByDay.monday = "low";
    d.preferences.energyByDay.saturday = "high";
    const { plan } = generateWeekPlan(d);
    const monday = plan.slots.find((s) => s.day === "monday")!;
    const mondayMeals = monday.optionIds.map(
      (id) => d.safeMeals.find((m) => m.id === id)!.name
    );
    expect(mondayMeals).toEqual(["Easy"]); // high-effort never on a low day
    const saturday = plan.slots.find((s) => s.day === "saturday")!;
    expect(saturday.optionIds.length).toBeGreaterThan(1);
  });

  it("is deterministic without a surprise seed", () => {
    const d = baseData([
      meal({ name: "A" }),
      meal({ name: "B" }),
      meal({ name: "C" }),
    ]);
    const p1 = generateWeekPlan(d).plan.slots.map((s) => s.optionIds);
    const p2 = generateWeekPlan(d).plan.slots.map((s) => s.optionIds);
    expect(p1).toEqual(p2);
  });

  it("honours fixed-day pinning", () => {
    const d = baseData([
      meal({ name: "Taco Tuesday", fixedDay: "tuesday" }),
      meal({ name: "Anything" }),
    ]);
    const { plan } = generateWeekPlan(d);
    const tuesday = plan.slots.find((s) => s.day === "tuesday")!;
    const first = d.safeMeals.find((m) => m.id === tuesday.optionIds[0])!;
    expect(first.name).toBe("Taco Tuesday");
    // …and it isn't offered on other days
    const wednesday = plan.slots.find((s) => s.day === "wednesday")!;
    expect(
      wednesday.optionIds.map((id) => d.safeMeals.find((m) => m.id === id)!.name)
    ).not.toContain("Taco Tuesday");
  });

  it("limits options per slot to the configured number", () => {
    const d = baseData(
      ["A", "B", "C", "D", "E", "F"].map((name) => meal({ name }))
    );
    d.preferences.optionsPerSlot = 2;
    const { plan } = generateWeekPlan(d);
    for (const slot of plan.slots) {
      expect(slot.optionIds.length).toBeLessThanOrEqual(2);
    }
  });

  it("warns when the estimated week exceeds the budget cap", () => {
    const d = baseData([meal({ name: "Pricey", estCost: 10 })]);
    d.preferences.budget.weeklyCap = 20; // 7 days × £10 = £70
    const { plan, warnings } = generateWeekPlan(d);
    expect(plan.budgetWarning).toBeTruthy();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("adds a warning note for days with no eligible meals", () => {
    const d = baseData([meal({ name: "Hard only", effort: "high" })]);
    d.preferences.energyByDay.monday = "low";
    const { plan } = generateWeekPlan(d);
    const monday = plan.slots.find((s) => s.day === "monday")!;
    expect(monday.optionIds).toHaveLength(0);
    expect(monday.note).toBeTruthy();
  });

  it("never suggests starter-library meals when new foods are off", () => {
    const d = baseData([meal({ name: "Mine" })]);
    d.preferences.rotation = "mostly-safe";
    d.preferences.newFoodsOptIn = false;
    const { plan } = generateWeekPlan(d);
    for (const slot of plan.slots) {
      for (const id of slot.optionIds) {
        expect(id.startsWith("new_")).toBe(false);
      }
    }
  });
});
