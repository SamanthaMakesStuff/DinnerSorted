/**
 * Supermarket catalogue on the app side: the API shape of a product row
 * and the conversion into a SafeMeal so the existing filtering engine
 * (buildMealPool — medical exclusions, sensory rules, budget) applies to
 * catalogue meals exactly as it does to the user's own.
 */
import type { SafeMeal, EnergyLevel } from "./types";

export interface CatalogueProduct {
  id: string;
  supermarket: string;
  url: string;
  name: string;
  pricePence: number | null;
  sizeText: string;
  portions: number | null;
  ingredientsText: string;
  allergens: string[];
  mayContain: string[];
  cookMinutes: number | null;
  dietFlags: string[];
  category: string;
  imageUrl: string;
}

/** Ready-meal effort from cooking time: microwave-quick = a bad-day meal. */
export function effortFromCookMinutes(mins: number | null): EnergyLevel {
  if (mins == null) return "low"; // ready meals default to low effort
  if (mins <= 12) return "low";
  if (mins <= 30) return "medium";
  return "high";
}

/** Per-portion price in pounds, when known. */
export function pricePerPortion(p: CatalogueProduct): number | null {
  if (p.pricePence == null) return null;
  const portions = p.portions && p.portions > 0 ? p.portions : 1;
  return Math.round(p.pricePence / portions) / 100;
}

/**
 * Convert a product to a SafeMeal. `isNew` marks it as an unfamiliar food:
 * true when the plan generator suggests it (gated by the new-foods opt-in),
 * false when the user deliberately adds it to their own list.
 */
export function productToSafeMeal(
  p: CatalogueProduct,
  opts: { isNew: boolean }
): SafeMeal {
  return {
    id: `cat_${p.id}`,
    name: p.name,
    notes: `${p.supermarket} ready meal${p.sizeText ? `, ${p.sizeText}` : ""}${
      p.cookMinutes != null ? ` · about ${p.cookMinutes} min` : ""
    }`,
    effort: effortFromCookMinutes(p.cookMinutes),
    steps: 1,
    pans: 0,
    equipment: [], // heat-at-home; equipment needs are minimal and vary
    temperature: "hot",
    tags: [],
    ingredients: [],
    estCost: pricePerPortion(p),
    allergens: p.allergens,
    traceAllergens: p.mayContain,
    isNew: opts.isNew,
    freezable: false,
    fixedDay: null,
  };
}
