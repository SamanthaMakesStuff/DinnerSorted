import type { Preferences, UserData } from "./types";

export function defaultPreferences(): Preferences {
  return {
    allergens: [],
    dietType: "omnivore",
    dietTypeOther: "",
    religiousDiet: [],
    avoidFoods: [],
    sensory: {
      textureAvoid: [],
      texturePrefer: [],
      foodsCanTouch: true,
      temperature: "any",
      visualNotes: "",
      smellSensitive: false,
    },
    energyByDay: {
      monday: "medium",
      tuesday: "medium",
      wednesday: "medium",
      thursday: "medium",
      friday: "medium",
      saturday: "medium",
      sunday: "medium",
    },
    complexity: { maxSteps: null, maxIngredients: null, maxPans: null },
    equipment: ["Microwave", "Oven", "Hob", "Kettle", "Toaster"],
    emergencyMeals: ["Cereal", "Toast"],
    budget: { weeklyCap: null, perMealCap: null },
    shopping: {
      supermarkets: [],
      primarySupermarket: "",
      householdSize: 1,
      householdNotes: "",
    },
    medication: { enabled: false, notes: "", lowAppetiteWindows: [] },
    rotation: "rotate",
    // Hard default per spec: never surprise the user with new foods.
    newFoodsOptIn: false,
    optionsPerSlot: 2,
  };
}

export function defaultUserData(): UserData {
  return {
    version: 1,
    preferences: defaultPreferences(),
    safeMeals: [],
    planHistory: [],
    freezer: [],
    reminders: {
      enabled: false,
      times: [{ label: "Dinner", time: "18:00" }],
      respectLowAppetiteWindows: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

let counter = 0;
/** Small collision-safe id generator (no dependency needed). */
export function makeId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}${counter.toString(36)}`;
}
