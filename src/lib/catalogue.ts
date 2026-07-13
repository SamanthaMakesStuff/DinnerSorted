/**
 * Supermarket catalogue on the app side: the API shape of a product row
 * and the conversion into a SafeMeal so the existing filtering engine
 * (buildMealPool — medical exclusions, sensory rules, budget) applies to
 * catalogue meals exactly as it does to the user's own.
 */
import type { SafeMeal, EnergyLevel, Preferences } from "./types";

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
  cookingInstructions: string;
  /** Kitchen tools mentioned in the instructions — any ONE is enough. */
  cookTools: string[];
  dietFlags: string[];
  category: string;
  imageUrl: string;
}

/**
 * Can the user cook this with the equipment they have? Ready-meal cooking
 * tools are ALTERNATIVES (microwave OR oven), so having any one is enough.
 * Unknown tools, or a user who hasn't listed equipment, never blocks.
 */
export function productCookable(
  p: Pick<CatalogueProduct, "cookTools">,
  prefs: Pick<Preferences, "equipment">
): boolean {
  if (!p.cookTools || p.cookTools.length === 0) return true;
  if (!prefs.equipment || prefs.equipment.length === 0) return true;
  const have = new Set(prefs.equipment.map((e) => e.toLowerCase()));
  return p.cookTools.some((t) => have.has(t.toLowerCase()));
}

/** Plain-language reason a product is hidden for equipment, or null. */
export function equipmentReason(
  p: Pick<CatalogueProduct, "cookTools">,
  prefs: Pick<Preferences, "equipment">
): string | null {
  if (productCookable(p, prefs)) return null;
  return `needs one of: ${p.cookTools.join(" or ")} — you haven't listed any of these in your kitchen equipment`;
}

/**
 * Ready-meal effort from cooking method and time. A microwaveable ready
 * meal is the canonical zero-effort dinner regardless of the pack's oven
 * time — waiting isn't effort. Oven-only meals grade by time.
 */
export function effortFromCookMinutes(
  mins: number | null,
  cookTools: string[] = []
): EnergyLevel {
  if (cookTools.some((t) => t.toLowerCase() === "microwave")) return "low";
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
    }${p.cookTools.length > 0 ? ` · ${p.cookTools.join(" or ")}` : ""}`,
    effort: effortFromCookMinutes(p.cookMinutes, p.cookTools),
    steps: 1,
    pans: 0,
    // Cookability is enforced separately as "any one of these tools" via
    // productCookable(); leaving equipment empty avoids the all-of exclusion.
    equipment: [],
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
