import { describe, expect, it } from "vitest";
import { buildShoppingList } from "../shopping";
import { generateWeekPlan } from "../generation";
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

function dataWith(meals: SafeMeal[]): UserData {
  return { ...defaultUserData(), safeMeals: meals };
}

describe("buildShoppingList", () => {
  it("lists a meal itself when it has no itemised ingredients", () => {
    const d = dataWith([meal({ name: "Fish and chips", estCost: 4 })]);
    const { plan } = generateWeekPlan(d);
    const list = buildShoppingList(d, plan);
    const other = list.groups.find((g) => g.category === "Other");
    expect(other).toBeDefined();
    const line = other!.lines.find((l) => l.name === "Fish and chips");
    expect(line).toBeDefined();
    // Offered every day of the week → one quantity entry per day
    expect(line!.quantities.length).toBe(7);
    expect(line!.quantities[0]).toMatch(/1 meal \(Monday\)/);
    expect(list.estTotal).toBe(28); // £4 × 7 days × household of 1
  });

  it("mixes ingredient lines and meal-fallback lines", () => {
    const d = dataWith([
      meal({
        name: "Beans on toast",
        fixedDay: "monday",
        ingredients: [
          { name: "Baked beans", category: "Cupboard", quantity: "1 tin", estCost: 0.5 },
        ],
      }),
      meal({ name: "Ready meal", estCost: 3 }),
    ]);
    const { plan } = generateWeekPlan(d);
    const list = buildShoppingList(d, plan);
    const names = list.groups.flatMap((g) => g.lines.map((l) => l.name));
    expect(names).toContain("Baked beans");
    expect(names).toContain("Ready meal");
  });
});
