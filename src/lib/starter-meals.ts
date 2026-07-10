/**
 * A small built-in library of simple, common UK meals.
 *
 * Two uses:
 *  1. "Quick add" on the Safe Meals page so a new user isn't facing a blank
 *     form (they choose what's safe — nothing is added automatically).
 *  2. The ONLY source of "new food" suggestions, and only when the user has
 *     explicitly switched new foods ON (default is off).
 *
 * Costs are rough estimates in pounds for a single portion; users can edit
 * everything after adding.
 */
import type { SafeMeal } from "./types";

// Omit id — assigned when the user adds one to their own list.
export type StarterMeal = Omit<SafeMeal, "id">;

const meal = (m: Partial<StarterMeal> & Pick<StarterMeal, "name" | "effort" | "ingredients">): StarterMeal => ({
  notes: "",
  steps: null,
  pans: null,
  equipment: [],
  temperature: "hot",
  tags: [],
  estCost: null,
  allergens: [],
  traceAllergens: [],
  isNew: false,
  freezable: false,
  fixedDay: null,
  ...m,
});

export const STARTER_MEALS: StarterMeal[] = [
  meal({
    name: "Beans on toast",
    effort: "low",
    steps: 2,
    pans: 1,
    equipment: ["Toaster", "Microwave"],
    tags: ["soft", "mild"],
    allergens: ["Cereals containing gluten"],
    ingredients: [
      { name: "Baked beans", category: "Cupboard", quantity: "1 tin", estCost: 0.5 },
      { name: "Bread", category: "Bakery", quantity: "2 slices", estCost: 0.2 },
      { name: "Butter", category: "Dairy & eggs", quantity: "a little", estCost: 0.1 },
    ],
    estCost: 0.8,
  }),
  meal({
    name: "Jacket potato with cheese",
    effort: "low",
    steps: 3,
    pans: 0,
    equipment: ["Microwave"],
    tags: ["soft", "plain"],
    allergens: ["Milk"],
    ingredients: [
      { name: "Baking potato", category: "Fruit & vegetables", quantity: "1", estCost: 0.35 },
      { name: "Cheddar cheese", category: "Dairy & eggs", quantity: "50g", estCost: 0.6 },
      { name: "Butter", category: "Dairy & eggs", quantity: "a little", estCost: 0.1 },
    ],
    estCost: 1.05,
  }),
  meal({
    name: "Pasta with butter (or plain sauce)",
    effort: "low",
    steps: 2,
    pans: 1,
    equipment: ["Hob"],
    tags: ["plain", "soft", "beige"],
    allergens: ["Cereals containing gluten", "Milk"],
    ingredients: [
      { name: "Pasta", category: "Cupboard", quantity: "100g", estCost: 0.25 },
      { name: "Butter", category: "Dairy & eggs", quantity: "a little", estCost: 0.1 },
    ],
    estCost: 0.35,
  }),
  meal({
    name: "Tomato pasta",
    effort: "medium",
    steps: 4,
    pans: 2,
    equipment: ["Hob"],
    tags: ["saucy", "mixed textures"],
    allergens: ["Cereals containing gluten"],
    ingredients: [
      { name: "Pasta", category: "Cupboard", quantity: "100g", estCost: 0.25 },
      { name: "Pasta sauce", category: "Cupboard", quantity: "half a jar", estCost: 0.7 },
    ],
    estCost: 0.95,
  }),
  meal({
    name: "Fish fingers, chips and peas",
    effort: "low",
    steps: 2,
    pans: 0,
    equipment: ["Oven"],
    tags: ["crunchy", "separate foods"],
    allergens: ["Fish", "Cereals containing gluten"],
    ingredients: [
      { name: "Fish fingers", category: "Frozen", quantity: "4", estCost: 1.0 },
      { name: "Oven chips", category: "Frozen", quantity: "1 portion", estCost: 0.5 },
      { name: "Frozen peas", category: "Frozen", quantity: "1 portion", estCost: 0.25 },
    ],
    estCost: 1.75,
    freezable: false,
  }),
  meal({
    name: "Chicken nuggets and chips",
    effort: "low",
    steps: 2,
    pans: 0,
    equipment: ["Oven"],
    tags: ["crunchy", "beige", "separate foods"],
    allergens: ["Cereals containing gluten"],
    ingredients: [
      { name: "Chicken nuggets", category: "Frozen", quantity: "1 portion", estCost: 1.2 },
      { name: "Oven chips", category: "Frozen", quantity: "1 portion", estCost: 0.5 },
    ],
    estCost: 1.7,
  }),
  meal({
    name: "Scrambled eggs on toast",
    effort: "low",
    steps: 3,
    pans: 1,
    equipment: ["Hob", "Toaster"],
    tags: ["soft", "mild"],
    allergens: ["Eggs", "Cereals containing gluten", "Milk"],
    ingredients: [
      { name: "Eggs", category: "Dairy & eggs", quantity: "2", estCost: 0.5 },
      { name: "Bread", category: "Bakery", quantity: "2 slices", estCost: 0.2 },
      { name: "Butter", category: "Dairy & eggs", quantity: "a little", estCost: 0.1 },
    ],
    estCost: 0.8,
  }),
  meal({
    name: "Cheese toastie",
    effort: "low",
    steps: 3,
    pans: 1,
    equipment: ["Hob"],
    tags: ["crunchy outside", "beige"],
    allergens: ["Cereals containing gluten", "Milk"],
    ingredients: [
      { name: "Bread", category: "Bakery", quantity: "2 slices", estCost: 0.2 },
      { name: "Cheddar cheese", category: "Dairy & eggs", quantity: "50g", estCost: 0.6 },
      { name: "Butter", category: "Dairy & eggs", quantity: "a little", estCost: 0.1 },
    ],
    estCost: 0.9,
  }),
  meal({
    name: "Stir-fry with ready noodles",
    effort: "medium",
    steps: 4,
    pans: 1,
    equipment: ["Hob"],
    tags: ["mixed textures", "strong smell"],
    allergens: ["Cereals containing gluten", "Soybeans"],
    traceAllergens: ["Sesame"],
    ingredients: [
      { name: "Straight-to-wok noodles", category: "Cupboard", quantity: "1 pack", estCost: 0.9 },
      { name: "Stir-fry vegetables", category: "Fruit & vegetables", quantity: "1 pack", estCost: 1.2 },
      { name: "Soy sauce", category: "Cupboard", quantity: "a splash", estCost: 0.1 },
    ],
    estCost: 2.2,
  }),
  meal({
    name: "Sausages, mash and gravy",
    effort: "high",
    steps: 6,
    pans: 2,
    equipment: ["Hob", "Oven"],
    tags: ["soft", "saucy"],
    allergens: ["Cereals containing gluten", "Milk", "Sulphur dioxide/sulphites"],
    ingredients: [
      { name: "Sausages", category: "Meat & fish", quantity: "3", estCost: 1.2 },
      { name: "Potatoes", category: "Fruit & vegetables", quantity: "300g", estCost: 0.4 },
      { name: "Gravy granules", category: "Cupboard", quantity: "a little", estCost: 0.15 },
      { name: "Butter", category: "Dairy & eggs", quantity: "a little", estCost: 0.1 },
    ],
    estCost: 1.85,
    freezable: true,
  }),
  meal({
    name: "Veggie chilli with rice",
    effort: "high",
    steps: 6,
    pans: 2,
    equipment: ["Hob"],
    tags: ["mixed textures", "saucy", "spicy", "strong smell"],
    ingredients: [
      { name: "Tinned mixed beans", category: "Cupboard", quantity: "1 tin", estCost: 0.6 },
      { name: "Chopped tomatoes", category: "Cupboard", quantity: "1 tin", estCost: 0.45 },
      { name: "Rice", category: "Cupboard", quantity: "75g", estCost: 0.2 },
      { name: "Onion", category: "Fruit & vegetables", quantity: "1", estCost: 0.15 },
      { name: "Chilli powder", category: "Cupboard", quantity: "a little", estCost: 0.05 },
    ],
    estCost: 1.45,
    freezable: true,
  }),
  meal({
    name: "Tuna pasta bake",
    effort: "high",
    steps: 5,
    pans: 2,
    equipment: ["Hob", "Oven"],
    tags: ["mixed textures", "strong smell"],
    allergens: ["Fish", "Cereals containing gluten", "Milk"],
    ingredients: [
      { name: "Pasta", category: "Cupboard", quantity: "100g", estCost: 0.25 },
      { name: "Tinned tuna", category: "Cupboard", quantity: "1 tin", estCost: 0.9 },
      { name: "Pasta sauce", category: "Cupboard", quantity: "half a jar", estCost: 0.7 },
      { name: "Cheddar cheese", category: "Dairy & eggs", quantity: "50g", estCost: 0.6 },
    ],
    estCost: 2.45,
    freezable: true,
  }),
  meal({
    name: "Soup and bread roll",
    effort: "low",
    steps: 2,
    pans: 1,
    equipment: ["Microwave"],
    tags: ["soft", "smooth"],
    allergens: ["Cereals containing gluten", "Celery"],
    ingredients: [
      { name: "Tinned soup", category: "Cupboard", quantity: "1 tin", estCost: 0.8 },
      { name: "Bread roll", category: "Bakery", quantity: "1", estCost: 0.3 },
    ],
    estCost: 1.1,
  }),
  meal({
    name: "Omelette",
    effort: "medium",
    steps: 4,
    pans: 1,
    equipment: ["Hob"],
    tags: ["soft", "plain"],
    allergens: ["Eggs", "Milk"],
    ingredients: [
      { name: "Eggs", category: "Dairy & eggs", quantity: "3", estCost: 0.75 },
      { name: "Cheddar cheese", category: "Dairy & eggs", quantity: "30g", estCost: 0.4 },
      { name: "Butter", category: "Dairy & eggs", quantity: "a little", estCost: 0.1 },
    ],
    estCost: 1.25,
  }),
  meal({
    name: "Microwave rice with chicken",
    effort: "low",
    steps: 3,
    pans: 1,
    equipment: ["Microwave"],
    tags: ["soft", "plain", "separate foods"],
    ingredients: [
      { name: "Microwave rice pouch", category: "Cupboard", quantity: "1", estCost: 1.0 },
      { name: "Cooked chicken pieces", category: "Meat & fish", quantity: "1 pack", estCost: 1.8 },
    ],
    estCost: 2.8,
  }),
  meal({
    name: "Pesto pasta",
    effort: "low",
    steps: 3,
    pans: 1,
    equipment: ["Hob"],
    tags: ["saucy", "green"],
    allergens: ["Cereals containing gluten", "Milk"],
    traceAllergens: ["Tree nuts"],
    ingredients: [
      { name: "Pasta", category: "Cupboard", quantity: "100g", estCost: 0.25 },
      { name: "Pesto", category: "Cupboard", quantity: "2 tbsp", estCost: 0.5 },
    ],
    estCost: 0.75,
  }),
  meal({
    name: "Pizza (shop-bought)",
    effort: "low",
    steps: 1,
    pans: 0,
    equipment: ["Oven"],
    tags: ["crunchy", "beige"],
    allergens: ["Cereals containing gluten", "Milk"],
    ingredients: [
      { name: "Pizza", category: "Frozen", quantity: "1", estCost: 2.0 },
    ],
    estCost: 2.0,
  }),
  meal({
    name: "Salad bowl with falafel",
    effort: "low",
    steps: 2,
    pans: 0,
    equipment: [],
    temperature: "cold",
    tags: ["crunchy", "mixed textures", "cold"],
    traceAllergens: ["Sesame"],
    ingredients: [
      { name: "Salad bag", category: "Fruit & vegetables", quantity: "half", estCost: 0.6 },
      { name: "Falafel", category: "Fruit & vegetables", quantity: "1 pack", estCost: 1.5 },
      { name: "Houmous", category: "Fruit & vegetables", quantity: "2 tbsp", estCost: 0.4 },
    ],
    estCost: 2.5,
  }),
];

/** Meat/fish words used to keep new-food suggestions inside the diet type. */
const MEAT_WORDS = ["chicken", "sausage", "beef", "pork", "ham", "bacon", "nuggets"];
const FISH_WORDS = ["fish", "tuna", "salmon", "prawn"];
const ANIMAL_WORDS = ["cheese", "egg", "butter", "milk", "houmous"]; // houmous is vegan; butter/cheese/egg are not

function containsAny(meal: StarterMeal, words: string[]): boolean {
  const text = `${meal.name} ${meal.ingredients.map((i) => i.name).join(" ")}`.toLowerCase();
  return words.some((w) => text.includes(w));
}

export function starterMealFitsDiet(
  m: StarterMeal,
  diet: "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "other"
): boolean {
  if (diet === "omnivore" || diet === "other") return true;
  if (diet === "pescatarian") return !containsAny(m, MEAT_WORDS);
  if (diet === "vegetarian") return !containsAny(m, [...MEAT_WORDS, ...FISH_WORDS]);
  // vegan
  return (
    !containsAny(m, [...MEAT_WORDS, ...FISH_WORDS]) &&
    !containsAny(m, ANIMAL_WORDS.filter((w) => w !== "houmous")) &&
    !m.allergens.includes("Milk") &&
    !m.allergens.includes("Eggs")
  );
}

/**
 * Conservative keyword filter for religious/cultural dietary needs.
 * Deliberately errs on the side of exclusion (e.g. "sausages" are treated
 * as pork unless the user adds their own halal version as a safe meal —
 * their own meals are never filtered by this).
 */
const PORK_WORDS = [
  "pork", "ham", "bacon", "sausage", "gammon", "chorizo", "pepperoni", "salami",
];
const BEEF_WORDS = ["beef", "steak", "oxtail"];
const SHELLFISH_WORDS = [
  "prawn", "shrimp", "crab", "lobster", "mussel", "oyster", "squid", "scallop",
];

export function starterMealFitsReligiousDiet(
  m: StarterMeal,
  religiousDiet: string[]
): boolean {
  for (const need of religiousDiet) {
    const n = need.toLowerCase();
    if (n.includes("halal") || n.includes("no pork")) {
      if (containsAny(m, PORK_WORDS)) return false;
    }
    if (n.includes("kosher")) {
      if (containsAny(m, [...PORK_WORDS, ...SHELLFISH_WORDS])) return false;
      if (m.allergens.includes("Crustaceans") || m.allergens.includes("Molluscs"))
        return false;
    }
    if (n.includes("no beef")) {
      if (containsAny(m, BEEF_WORDS)) return false;
    }
  }
  return true;
}
