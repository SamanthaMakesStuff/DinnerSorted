import { describe, expect, it } from "vitest";
import { suggestSubstitutes } from "../substitutions";
import { linksFor, SUPERMARKET_LINKS } from "../supermarkets";
import { defaultPreferences } from "../defaults";

describe("suggestSubstitutes — allergy safety", () => {
  it("suggests swaps for a known ingredient", () => {
    const prefs = defaultPreferences();
    const swaps = suggestSubstitutes("Semi-skimmed milk", prefs);
    expect(swaps).toContain("Oat milk");
    expect(swaps).toContain("Lactose-free milk");
  });

  it("never suggests substitutes containing a medical allergen", () => {
    const prefs = defaultPreferences();
    prefs.allergens = [
      { name: "Milk", severity: "medical", crossContamination: true },
    ];
    const swaps = suggestSubstitutes("milk", prefs);
    expect(swaps).not.toContain("Lactose-free milk"); // contains Milk
    expect(swaps).toContain("Oat milk"); // safe
  });

  it("also filters avoid-level allergens (a swap that trips a dislike isn't helpful)", () => {
    const prefs = defaultPreferences();
    prefs.allergens = [
      { name: "Soybeans", severity: "avoid", crossContamination: false },
    ];
    const swaps = suggestSubstitutes("milk", prefs);
    expect(swaps).not.toContain("Soya milk");
  });

  it("filters swaps that match the foods-to-avoid list", () => {
    const prefs = defaultPreferences();
    prefs.avoidFoods = ["sweet potato"];
    const swaps = suggestSubstitutes("potato", prefs);
    expect(swaps).not.toContain("Sweet potato");
    expect(swaps).toContain("Rice");
  });

  it("returns an empty list for unknown ingredients rather than guessing", () => {
    const prefs = defaultPreferences();
    expect(suggestSubstitutes("dragon fruit compote", prefs)).toEqual([]);
  });

  it("stacked allergies can filter every option — empty beats unsafe", () => {
    const prefs = defaultPreferences();
    prefs.allergens = [
      { name: "Milk", severity: "medical", crossContamination: true },
      { name: "Soybeans", severity: "medical", crossContamination: true },
      { name: "Cereals containing gluten", severity: "medical", crossContamination: true },
    ];
    expect(suggestSubstitutes("milk", prefs)).toEqual([]);
  });
});

describe("supermarket search links", () => {
  it("builds an encoded search URL for every supported shop", () => {
    for (const shop of SUPERMARKET_LINKS) {
      const url = shop.searchUrl("baked beans");
      expect(url).toMatch(/^https:\/\//);
      expect(url).toContain("baked%20beans");
    }
  });

  it("returns only the user's chosen shops, primary first", () => {
    const links = linksFor(["Asda", "Tesco"], "Tesco");
    expect(links.map((l) => l.name)).toEqual(["Tesco", "Asda"]);
  });
});
