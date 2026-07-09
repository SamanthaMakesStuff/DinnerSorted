/**
 * Shopping list generation: aggregate the chosen meal per slot into a
 * checklist grouped by supermarket category, with a plain-text export.
 * Meals being taken from freezer stock contribute nothing to the list.
 */
import type { SafeMeal, ShopCategory, UserData, WeekPlan } from "./types";
import { DAY_LABELS, SHOP_CATEGORIES } from "./types";
import { resolvePlanMeal } from "./generation";

export interface ShoppingLine {
  /** Stable key for checkbox state. */
  key: string;
  name: string;
  category: ShopCategory;
  /** e.g. ["2 slices (Beans on toast — Monday)", "2 slices (Cheese toastie — Thursday)"] */
  quantities: string[];
  estCost: number | null;
}

export interface ShoppingList {
  groups: { category: ShopCategory; lines: ShoppingLine[] }[];
  estTotal: number | null;
  /** Meals covered by freezer stock (no shopping needed). */
  fromFreezer: string[];
}

export function buildShoppingList(data: UserData, plan: WeekPlan): ShoppingList {
  const lines = new Map<string, ShoppingLine>();
  const fromFreezer: string[] = [];
  let estTotal: number | null = 0;
  const householdMultiplier = Math.max(1, data.preferences.shopping.householdSize);

  for (const slot of plan.slots) {
    const mealId = slot.chosenId ?? slot.optionIds[0];
    if (!mealId) continue;
    const meal: SafeMeal | null = resolvePlanMeal(data, mealId);
    if (!meal) continue;

    if (slot.freezerOptionIds.includes(mealId)) {
      fromFreezer.push(`${meal.name} (${DAY_LABELS[slot.day]}) — from your freezer stock`);
      continue;
    }

    for (const ing of meal.ingredients) {
      const key = `${ing.category}::${ing.name.trim().toLowerCase()}`;
      const qty = ing.quantity
        ? `${ing.quantity} (${meal.name} — ${DAY_LABELS[slot.day]})`
        : `for ${meal.name} — ${DAY_LABELS[slot.day]}`;
      const existing = lines.get(key);
      if (existing) {
        existing.quantities.push(qty);
        if (existing.estCost != null) {
          if (ing.estCost == null) existing.estCost = null;
          else existing.estCost += ing.estCost * householdMultiplier;
        }
      } else {
        lines.set(key, {
          key,
          name: ing.name.trim(),
          category: ing.category,
          quantities: [qty],
          estCost: ing.estCost == null ? null : ing.estCost * householdMultiplier,
        });
      }
    }
  }

  for (const line of lines.values()) {
    if (line.estCost == null) estTotal = null;
    else if (estTotal != null) estTotal += line.estCost;
  }

  const groups = SHOP_CATEGORIES.map((category) => ({
    category,
    lines: [...lines.values()]
      .filter((l) => l.category === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.lines.length > 0);

  return { groups, estTotal, fromFreezer };
}

/** Plain-text version for copying/downloading — screen-reader and paper friendly. */
export function shoppingListAsText(list: ShoppingList, planLabel: string): string {
  const out: string[] = [`Shopping list — ${planLabel}`, ""];
  for (const group of list.groups) {
    out.push(group.category.toUpperCase());
    for (const line of group.lines) {
      out.push(`  [ ] ${line.name} — ${line.quantities.join("; ")}`);
    }
    out.push("");
  }
  if (list.fromFreezer.length > 0) {
    out.push("ALREADY IN YOUR FREEZER (nothing to buy)");
    for (const f of list.fromFreezer) out.push(`  • ${f}`);
    out.push("");
  }
  if (list.estTotal != null) {
    out.push(`Estimated total: £${list.estTotal.toFixed(2)}`);
  }
  return out.join("\n");
}
