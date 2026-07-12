import { describe, expect, it } from "vitest";
import {
  effortFromCookMinutes,
  equipmentReason,
  pricePerPortion,
  productCookable,
  productToSafeMeal,
  type CatalogueProduct,
} from "../catalogue";
import { defaultPreferences } from "../defaults";
import { generateWeekPlan, resolvePlanMeal } from "../generation";
import { defaultUserData } from "../defaults";
import type { SafeMeal, UserData } from "../types";

const product = (patch: Partial<CatalogueProduct> = {}): CatalogueProduct => ({
  id: "tesco:1",
  supermarket: "Tesco",
  url: "https://www.tesco.com/groceries/en-GB/products/1",
  name: "Tesco Chicken Tikka Masala 450G",
  pricePence: 385,
  sizeText: "450g",
  portions: 1,
  ingredientsText: "Chicken, Rice, Cream (Milk)",
  allergens: ["Milk"],
  mayContain: ["Mustard"],
  cookMinutes: 4,
  cookingInstructions: "Microwave 900W for 5 mins. Or oven 25 mins.",
  cookTools: ["Microwave", "Oven"],
  dietFlags: [],
  category: "Ready meals",
  imageUrl: "",
  ...patch,
});

function safeMeal(name: string): SafeMeal {
  return {
    id: `m_${name}`,
    name,
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

describe("catalogue conversion", () => {
  it("maps cook time to effort", () => {
    expect(effortFromCookMinutes(4)).toBe("low");
    expect(effortFromCookMinutes(25)).toBe("medium");
    expect(effortFromCookMinutes(45)).toBe("high");
    expect(effortFromCookMinutes(null)).toBe("low");
  });

  it("computes per-portion price", () => {
    expect(pricePerPortion(product({ pricePence: 500, portions: 2 }))).toBe(2.5);
    expect(pricePerPortion(product({ pricePence: null }))).toBeNull();
  });

  it("carries allergens and traces onto the meal", () => {
    const meal = productToSafeMeal(product(), { isNew: true });
    expect(meal.allergens).toEqual(["Milk"]);
    expect(meal.traceAllergens).toEqual(["Mustard"]);
    expect(meal.isNew).toBe(true);
    expect(meal.estCost).toBe(3.85);
  });
});

describe("productCookable (any-of equipment)", () => {
  it("is cookable when the user has ANY listed tool", () => {
    const prefs = defaultPreferences();
    prefs.equipment = ["Microwave"]; // meal lists Microwave OR Oven
    expect(productCookable(product(), prefs)).toBe(true);
    expect(equipmentReason(product(), prefs)).toBeNull();
  });

  it("is NOT cookable when the user has none of the tools", () => {
    const prefs = defaultPreferences();
    prefs.equipment = ["Kettle", "Toaster"];
    const p = product({ cookTools: ["Microwave", "Oven"] });
    expect(productCookable(p, prefs)).toBe(false);
    expect(equipmentReason(p, prefs)).toMatch(/Microwave or Oven/);
  });

  it("never blocks when tools are unknown or user hasn't listed equipment", () => {
    const prefs = defaultPreferences();
    prefs.equipment = [];
    expect(productCookable(product(), prefs)).toBe(true);
    prefs.equipment = ["Kettle"];
    expect(productCookable(product({ cookTools: [] }), prefs)).toBe(true);
  });
});

describe("generation with a catalogue", () => {
  function base(): UserData {
    const d = defaultUserData();
    d.safeMeals = [safeMeal("Own meal A"), safeMeal("Own meal B")];
    d.preferences.rotation = "mostly-safe";
    d.preferences.newFoodsOptIn = true;
    return d;
  }

  it("suggests a catalogue meal and embeds it in the plan", () => {
    const d = base();
    const cat = [productToSafeMeal(product(), { isNew: true })];
    const { plan } = generateWeekPlan(d, { catalogue: cat });
    const offered = plan.slots.flatMap((s) => s.optionIds);
    expect(offered).toContain("cat_tesco:1");
    expect(plan.extraMeals?.map((m) => m.id)).toContain("cat_tesco:1");
    // resolvable from history without any catalogue access
    d.planHistory = [plan];
    expect(resolvePlanMeal(d, "cat_tesco:1")?.name).toContain("Tikka");
  });

  it("never suggests catalogue meals containing a medical allergen", () => {
    const d = base();
    d.preferences.allergens = [
      { name: "Milk", severity: "medical", crossContamination: false },
    ];
    const cat = [productToSafeMeal(product(), { isNew: true })]; // contains Milk
    const { plan } = generateWeekPlan(d, { catalogue: cat });
    expect(plan.slots.flatMap((s) => s.optionIds)).not.toContain("cat_tesco:1");
  });

  it("never suggests anything when new foods are off, catalogue or not", () => {
    const d = base();
    d.preferences.newFoodsOptIn = false;
    const cat = [productToSafeMeal(product(), { isNew: true })];
    const { plan } = generateWeekPlan(d, { catalogue: cat });
    expect(plan.slots.flatMap((s) => s.optionIds)).not.toContain("cat_tesco:1");
    expect(plan.extraMeals ?? []).toHaveLength(0);
  });

  it("high-effort catalogue meals are not offered as new-food gambles", () => {
    const d = base();
    const cat = [
      productToSafeMeal(product({ cookMinutes: 45 }), { isNew: true }),
    ];
    const { plan } = generateWeekPlan(d, { catalogue: cat });
    expect(plan.slots.flatMap((s) => s.optionIds)).not.toContain("cat_tesco:1");
  });
});
