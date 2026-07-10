/**
 * Substitution suggestions for when a shopping-list item is unavailable.
 *
 * Safety rule (spec §4.3): substitutes are filtered against the user's
 * allergen list. Anything containing an allergen the user avoids — medical
 * OR preference level — is never suggested; a swap that trips an allergy or
 * a dislike isn't a helpful swap. Returns an empty list rather than
 * anything unsafe.
 */
import type { Preferences } from "./types";

interface Substitute {
  name: string;
  /** Allergen names this substitute contains. */
  allergens: string[];
}

interface SubRule {
  /** Lower-case keywords matched against the ingredient name. */
  keywords: string[];
  alternatives: Substitute[];
}

const RULES: SubRule[] = [
  {
    keywords: ["milk"],
    alternatives: [
      { name: "Oat milk", allergens: ["Cereals containing gluten"] },
      { name: "Soya milk", allergens: ["Soybeans"] },
      { name: "Lactose-free milk", allergens: ["Milk"] },
    ],
  },
  {
    keywords: ["butter"],
    alternatives: [
      { name: "Dairy-free spread", allergens: [] },
      { name: "Olive oil (for cooking)", allergens: [] },
    ],
  },
  {
    keywords: ["cheddar", "cheese"],
    alternatives: [
      { name: "A different hard cheese (e.g. Red Leicester)", allergens: ["Milk"] },
      { name: "Dairy-free cheese", allergens: [] },
    ],
  },
  {
    keywords: ["pasta", "spaghetti"],
    alternatives: [
      { name: "A different pasta shape", allergens: ["Cereals containing gluten"] },
      { name: "Gluten-free pasta", allergens: [] },
      { name: "Rice", allergens: [] },
    ],
  },
  {
    keywords: ["bread", "roll", "toast"],
    alternatives: [
      { name: "A different loaf or rolls", allergens: ["Cereals containing gluten"] },
      { name: "Gluten-free bread", allergens: [] },
      { name: "Wraps", allergens: ["Cereals containing gluten"] },
    ],
  },
  {
    keywords: ["egg"],
    alternatives: [{ name: "Egg replacer (for baking)", allergens: [] }],
  },
  {
    keywords: ["chicken"],
    alternatives: [
      { name: "Turkey pieces", allergens: [] },
      { name: "Quorn pieces", allergens: ["Eggs"] },
    ],
  },
  {
    keywords: ["sausage"],
    alternatives: [
      { name: "A different brand of sausages", allergens: [] },
      { name: "Vegetarian sausages", allergens: ["Soybeans"] },
    ],
  },
  {
    keywords: ["mince", "beef"],
    alternatives: [
      { name: "Turkey mince", allergens: [] },
      { name: "Soya or pea-protein mince", allergens: ["Soybeans"] },
    ],
  },
  {
    keywords: ["tuna"],
    alternatives: [
      { name: "Tinned salmon", allergens: ["Fish"] },
      { name: "Chickpeas (for a similar texture)", allergens: [] },
    ],
  },
  {
    keywords: ["baked beans"],
    alternatives: [
      { name: "A different brand of baked beans", allergens: [] },
      { name: "Spaghetti hoops", allergens: ["Cereals containing gluten"] },
    ],
  },
  {
    keywords: ["potato"],
    alternatives: [
      { name: "Sweet potato", allergens: [] },
      { name: "Rice", allergens: [] },
    ],
  },
  {
    keywords: ["rice"],
    alternatives: [
      { name: "Microwave rice pouch", allergens: [] },
      { name: "Couscous", allergens: ["Cereals containing gluten"] },
      { name: "Pasta", allergens: ["Cereals containing gluten"] },
    ],
  },
  {
    keywords: ["pesto"],
    alternatives: [
      { name: "Tomato pasta sauce", allergens: [] },
      { name: "Nut-free pesto", allergens: ["Milk"] },
    ],
  },
  {
    keywords: ["soy sauce"],
    alternatives: [
      { name: "Tamari (gluten-free soy sauce)", allergens: ["Soybeans"] },
      { name: "A pinch of salt", allergens: [] },
    ],
  },
  {
    keywords: ["yoghurt", "yogurt"],
    alternatives: [
      { name: "Coconut yoghurt", allergens: [] },
      { name: "Soya yoghurt", allergens: ["Soybeans"] },
    ],
  },
];

/**
 * Suggestions for an unavailable ingredient, filtered by the user's
 * allergen settings and avoid-list.
 */
export function suggestSubstitutes(
  ingredientName: string,
  prefs: Preferences
): string[] {
  const name = ingredientName.toLowerCase();
  const rule = RULES.find((r) => r.keywords.some((k) => name.includes(k)));
  if (!rule) return [];

  return rule.alternatives
    .filter((alt) => {
      for (const a of prefs.allergens) {
        if (alt.allergens.some((x) => x.toLowerCase() === a.name.toLowerCase()))
          return false;
      }
      for (const term of prefs.avoidFoods) {
        const t = term.trim().toLowerCase();
        if (t && alt.name.toLowerCase().includes(t)) return false;
      }
      return true;
    })
    .map((alt) => alt.name);
}
