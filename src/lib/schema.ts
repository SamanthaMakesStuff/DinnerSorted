/**
 * Zod schema for the UserData document.
 *
 * Used to validate: (a) JSON files uploaded via "Upload my data",
 * (b) payloads sent to the account-sync API. Unknown fields are stripped;
 * malformed files produce a specific, plain-language error message.
 */
import { z } from "zod";
import { DAYS, SHOP_CATEGORIES } from "./types";
import type { UserData } from "./types";

const energy = z.enum(["low", "medium", "high"]);
const temperature = z.enum(["hot", "cold", "room", "any"]);
const day = z.enum(DAYS);

const allergenEntry = z.object({
  name: z.string().min(1).max(100),
  severity: z.enum(["avoid", "medical"]),
  crossContamination: z.boolean(),
});

const ingredient = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(SHOP_CATEGORIES).catch("Other"),
  quantity: z.string().max(100).default(""),
  estCost: z.number().min(0).max(10000).nullable().default(null),
});

const safeMeal = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).default(""),
  effort: energy.default("low"),
  steps: z.number().int().min(0).max(200).nullable().default(null),
  pans: z.number().int().min(0).max(50).nullable().default(null),
  equipment: z.array(z.string().max(100)).default([]),
  temperature: temperature.default("any"),
  tags: z.array(z.string().max(100)).default([]),
  ingredients: z.array(ingredient).default([]),
  estCost: z.number().min(0).max(10000).nullable().default(null),
  allergens: z.array(z.string().max(100)).default([]),
  traceAllergens: z.array(z.string().max(100)).default([]),
  isNew: z.boolean().default(false),
  freezable: z.boolean().default(false),
  fixedDay: day.nullable().default(null),
});

const planSlot = z.object({
  day,
  optionIds: z.array(z.string().max(100)).default([]),
  chosenId: z.string().max(100).nullable().default(null),
  freezerOptionIds: z.array(z.string().max(100)).default([]),
  note: z.string().max(500).nullable().default(null),
});

const weekPlan = z.object({
  id: z.string().min(1).max(100),
  createdAt: z.string().max(50),
  label: z.string().max(200).default(""),
  slots: z.array(planSlot),
  estTotal: z.number().min(0).nullable().default(null),
  budgetWarning: z.string().max(500).nullable().default(null),
  extraMeals: z.array(safeMeal).max(20).default([]),
});

const preferences = z.object({
  allergens: z.array(allergenEntry).default([]),
  dietType: z
    .enum(["omnivore", "vegetarian", "vegan", "pescatarian", "other"])
    .default("omnivore"),
  dietTypeOther: z.string().max(200).default(""),
  // default [] keeps older exports importable
  religiousDiet: z.array(z.string().max(100)).default([]),
  avoidFoods: z.array(z.string().max(100)).default([]),
  sensory: z
    .object({
      textureAvoid: z.array(z.string().max(100)).default([]),
      texturePrefer: z.array(z.string().max(100)).default([]),
      foodsCanTouch: z.boolean().default(true),
      temperature: temperature.default("any"),
      visualNotes: z.string().max(2000).default(""),
      smellSensitive: z.boolean().default(false),
    })
    .default({}),
  energyByDay: z
    .object({
      monday: energy,
      tuesday: energy,
      wednesday: energy,
      thursday: energy,
      friday: energy,
      saturday: energy,
      sunday: energy,
    })
    .default({
      monday: "medium",
      tuesday: "medium",
      wednesday: "medium",
      thursday: "medium",
      friday: "medium",
      saturday: "medium",
      sunday: "medium",
    }),
  complexity: z
    .object({
      maxSteps: z.number().int().min(1).max(200).nullable().default(null),
      maxIngredients: z.number().int().min(1).max(100).nullable().default(null),
      maxPans: z.number().int().min(1).max(50).nullable().default(null),
    })
    .default({}),
  equipment: z.array(z.string().max(100)).default([]),
  emergencyMeals: z.array(z.string().max(200)).default([]),
  budget: z
    .object({
      weeklyCap: z.number().min(0).max(100000).nullable().default(null),
      perMealCap: z.number().min(0).max(100000).nullable().default(null),
    })
    .default({}),
  shopping: z
    .object({
      supermarkets: z.array(z.string().max(100)).default([]),
      primarySupermarket: z.string().max(100).default(""),
      householdSize: z.number().int().min(1).max(20).default(1),
      householdNotes: z.string().max(2000).default(""),
    })
    .default({}),
  medication: z
    .object({
      enabled: z.boolean().default(false),
      notes: z.string().max(2000).default(""),
      lowAppetiteWindows: z
        .array(
          z.object({
            start: z.string().regex(/^\d{2}:\d{2}$/),
            end: z.string().regex(/^\d{2}:\d{2}$/),
            label: z.string().max(200).optional(),
          })
        )
        .default([]),
    })
    .default({}),
  rotation: z
    .enum(["same-every-week", "rotate", "mostly-safe"])
    .default("rotate"),
  newFoodsOptIn: z.boolean().default(false),
  optionsPerSlot: z
    .union([z.literal(2), z.literal(3)])
    .default(2),
});

const freezerItem = z.object({
  id: z.string().min(1).max(100),
  mealId: z.string().max(100).nullable().default(null),
  name: z.string().min(1).max(200),
  portions: z.number().int().min(0).max(1000),
  frozenOn: z.string().max(50).default(""),
  notes: z.string().max(1000).default(""),
});

const reminderSettings = z.object({
  enabled: z.boolean().default(false),
  times: z
    .array(
      z.object({
        label: z.string().max(100),
        time: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .default([]),
  respectLowAppetiteWindows: z.boolean().default(true),
});

export const userDataSchema = z.object({
  version: z.literal(1),
  preferences,
  safeMeals: z.array(safeMeal).max(500).default([]),
  planHistory: z.array(weekPlan).max(260).default([]),
  freezer: z.array(freezerItem).max(500).default([]),
  reminders: reminderSettings.default({}),
  updatedAt: z.string().max(50).default(""),
});

export type ParsedUserData = z.infer<typeof userDataSchema>;

export interface ImportResult {
  ok: boolean;
  data?: UserData;
  /** Plain-language error, safe to show directly to the user. */
  error?: string;
}

/** Parse + validate an uploaded JSON string. Never throws. */
export function parseImportedJson(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error:
        "That file isn't valid JSON. Please choose the file you downloaded from DinnerSorted (it ends in .json).",
    };
  }
  const result = userDataSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path?.length ? ` (problem near “${first.path.join(" → ")}”)` : "";
    return {
      ok: false,
      error: `That file doesn't look like a DinnerSorted export${where}. Nothing was changed. If you edited the file by hand, try re-downloading a fresh copy.`,
    };
  }
  return { ok: true, data: result.data as UserData };
}
