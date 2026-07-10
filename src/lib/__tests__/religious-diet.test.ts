import { describe, expect, it } from "vitest";
import { STARTER_MEALS, starterMealFitsReligiousDiet } from "../starter-meals";
import { parseImportedJson } from "../schema";
import { defaultUserData } from "../defaults";

const byName = (name: string) => STARTER_MEALS.find((m) => m.name === name)!;

describe("starterMealFitsReligiousDiet", () => {
  it("halal and no-pork exclude pork-word meals", () => {
    const sausages = byName("Sausages, mash and gravy");
    expect(starterMealFitsReligiousDiet(sausages, ["Halal"])).toBe(false);
    expect(starterMealFitsReligiousDiet(sausages, ["No pork"])).toBe(false);
    expect(starterMealFitsReligiousDiet(sausages, [])).toBe(true);
  });

  it("halal does not exclude fish or chicken meals", () => {
    expect(
      starterMealFitsReligiousDiet(byName("Fish fingers, chips and peas"), ["Halal"])
    ).toBe(true);
    expect(
      starterMealFitsReligiousDiet(byName("Chicken nuggets and chips"), ["Halal"])
    ).toBe(true);
  });

  it("kosher excludes pork and shellfish-allergen meals", () => {
    expect(
      starterMealFitsReligiousDiet(byName("Sausages, mash and gravy"), ["Kosher"])
    ).toBe(false);
    // no shellfish meals in the starter library; simulate one
    expect(
      starterMealFitsReligiousDiet(
        { ...byName("Tomato pasta"), allergens: ["Crustaceans"] },
        ["Kosher"]
      )
    ).toBe(false);
  });

  it("no-beef matches beef keywords only", () => {
    expect(
      starterMealFitsReligiousDiet(byName("Chicken nuggets and chips"), [
        "No beef (e.g. Hindu)",
      ])
    ).toBe(true);
    expect(
      starterMealFitsReligiousDiet(
        { ...byName("Tomato pasta"), name: "Beef ragu pasta" },
        ["No beef (e.g. Hindu)"]
      )
    ).toBe(false);
  });
});

describe("religiousDiet backwards compatibility", () => {
  it("imports pre-existing exports without the field", () => {
    const data = defaultUserData() as unknown as {
      preferences: Record<string, unknown>;
    };
    delete data.preferences.religiousDiet;
    const result = parseImportedJson(JSON.stringify(data));
    expect(result.ok).toBe(true);
    expect(result.data?.preferences.religiousDiet).toEqual([]);
  });
});
