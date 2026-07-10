/**
 * Core data model for DinnerSorted.
 *
 * Everything a user owns lives in a single `UserData` document. That same
 * shape is: (a) the guest-mode session state, (b) the JSON export/import
 * format, and (c) the JSONB blob stored per-account in Postgres — so backup,
 * portability and server persistence never drift apart.
 */

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/** The 14 UK regulated allergens (Food Standards Agency list). */
export const UK_ALLERGENS = [
  "Celery",
  "Cereals containing gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Lupin",
  "Milk",
  "Molluscs",
  "Mustard",
  "Peanuts",
  "Sesame",
  "Soybeans",
  "Sulphur dioxide/sulphites",
  "Tree nuts",
] as const;

export type AllergenSeverity = "avoid" | "medical";

export interface AllergenEntry {
  /** Allergen name — one of UK_ALLERGENS or free text. */
  name: string;
  /**
   * "avoid"   = preference/intolerance; excluded by default, override allowed.
   * "medical" = dangerous; hard exclusion, never substituted, never overridden.
   */
  severity: AllergenSeverity;
  /** If true, even trace/cross-contamination risk excludes a meal. */
  crossContamination: boolean;
}

export const DIET_TYPES = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "other",
] as const;
export type DietType = (typeof DIET_TYPES)[number];

/**
 * Religious/cultural dietary needs common in the UK. Kept separate from diet
 * type because they combine (e.g. Halal + omnivore). Free-text entries are
 * also allowed alongside these.
 */
export const RELIGIOUS_DIET_OPTIONS = [
  "Halal",
  "Kosher",
  "No beef (e.g. Hindu)",
  "No pork",
] as const;

export type EnergyLevel = "low" | "medium" | "high";
export const ENERGY_LEVELS: EnergyLevel[] = ["low", "medium", "high"];

export type TemperaturePref = "hot" | "cold" | "room" | "any";

export const EQUIPMENT_OPTIONS = [
  "Microwave",
  "Oven",
  "Hob",
  "Air fryer",
  "Kettle",
  "Toaster",
  "Slow cooker",
  "Grill",
  "Blender",
] as const;

export const UK_SUPERMARKETS = [
  "Tesco",
  "Sainsbury's",
  "Asda",
  "Morrisons",
  "Aldi",
  "Lidl",
  "Waitrose",
  "Co-op",
  "Iceland",
  "Ocado",
  "Cook",
] as const;
export type Supermarket = (typeof UK_SUPERMARKETS)[number];

/** How safe meals should repeat across weeks — user-controlled, never random. */
export type RotationSetting = "same-every-week" | "rotate" | "mostly-safe";

export const ROTATION_LABELS: Record<RotationSetting, string> = {
  "same-every-week":
    "Keep it the same — repeat the same plan every week (e.g. same dinner every Tuesday)",
  rotate: "Rotate steadily through my safe meals in a predictable order",
  "mostly-safe":
    "Mostly my safe meals, with the occasional new suggestion (only if new foods are switched on)",
};

export interface LowAppetiteWindow {
  /** 24h "HH:MM" strings. */
  start: string;
  end: string;
  label?: string;
}

export interface SensoryPreferences {
  /** Textures to avoid, e.g. "mushy", "mixed textures". */
  textureAvoid: string[];
  /** Textures actively preferred, e.g. "crunchy". */
  texturePrefer: string[];
  /** Are different foods allowed to touch on the plate? */
  foodsCanTouch: boolean;
  temperature: TemperaturePref;
  /** Free-text visual/colour sensitivities, e.g. "no sauces that stain food". */
  visualNotes: string;
  /** If true, avoid suggesting strong-smelling cooking methods. */
  smellSensitive: boolean;
}

export interface ComplexityLimits {
  maxSteps: number | null;
  maxIngredients: number | null;
  maxPans: number | null;
}

export interface Preferences {
  allergens: AllergenEntry[];
  dietType: DietType;
  dietTypeOther: string;
  /** Religious/cultural dietary needs — standard options plus free text. */
  religiousDiet: string[];
  /** Preference-level dislikes (NOT medical) — tags/free text. */
  avoidFoods: string[];
  sensory: SensoryPreferences;
  /** Energy level per day-slot — energy varies day to day. */
  energyByDay: Record<Day, EnergyLevel>;
  complexity: ComplexityLimits;
  /** Equipment the user actually has. */
  equipment: string[];
  /**
   * 2–3 zero-effort options (cereal, toast…) always shown regardless of plan.
   * Neutral framing only — never guilt-based.
   */
  emergencyMeals: string[];
  budget: {
    weeklyCap: number | null;
    perMealCap: number | null;
  };
  shopping: {
    supermarkets: string[];
    primarySupermarket: string;
    householdSize: number;
    householdNotes: string;
  };
  /** Optional + sensitive — never required. */
  medication: {
    enabled: boolean;
    notes: string;
    lowAppetiteWindows: LowAppetiteWindow[];
  };
  rotation: RotationSetting;
  /** Default OFF: unfamiliar meals never suggested unless explicitly opted in. */
  newFoodsOptIn: boolean;
  /** Fixed small number of choices per slot (2–3) to avoid choice paralysis. */
  optionsPerSlot: 2 | 3;
}

export const SHOP_CATEGORIES = [
  "Fruit & vegetables",
  "Meat & fish",
  "Dairy & eggs",
  "Bakery",
  "Frozen",
  "Cupboard",
  "Drinks",
  "Household",
  "Other",
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export interface Ingredient {
  name: string;
  category: ShopCategory;
  /** Free-text quantity, e.g. "2", "500g", "1 tin". */
  quantity: string;
  /** Estimated cost in pounds for the quantity above (optional). */
  estCost: number | null;
}

export interface SafeMeal {
  id: string;
  name: string;
  notes: string;
  /** Energy needed to make it — matched against the day's energy level. */
  effort: EnergyLevel;
  steps: number | null;
  pans: number | null;
  equipment: string[];
  temperature: TemperaturePref;
  /** Free-text tags: textures, flavours, "strong smell", etc. */
  tags: string[];
  ingredients: Ingredient[];
  /** Estimated total cost in pounds (falls back to sum of ingredient costs). */
  estCost: number | null;
  /** Allergens this meal contains (names matching AllergenEntry.name). */
  allergens: string[];
  /** Allergens present only as possible traces (cross-contamination risk). */
  traceAllergens: string[];
  /** True for meals the user hasn't tried — only suggested when opted in. */
  isNew: boolean;
  freezable: boolean;
  /** Pin this meal to a fixed day ("same dinner every Tuesday"). */
  fixedDay: Day | null;
}

export interface PlanSlot {
  day: Day;
  /** 2–3 meal ids offered for this slot. Never more — choice paralysis. */
  optionIds: string[];
  /** The option the user picked (defaults to the first when generating lists). */
  chosenId: string | null;
  /** Ids of options that would come from freezer stock rather than shopping. */
  freezerOptionIds: string[];
  /** Human-readable reason when a slot couldn't be filled. */
  note: string | null;
}

export interface WeekPlan {
  id: string;
  createdAt: string; // ISO
  label: string;
  slots: PlanSlot[];
  /** Estimated total cost of the chosen meals, if costs are known. */
  estTotal: number | null;
  /** Set when estTotal exceeds the weekly budget cap. */
  budgetWarning: string | null;
}

export interface FreezerItem {
  id: string;
  /** Meal id if it maps to a safe meal, else null. */
  mealId: string | null;
  name: string;
  portions: number;
  frozenOn: string; // ISO date
  notes: string;
}

export interface ReminderSettings {
  /** Meal-time reminders, delivered client-side while the app is open. */
  enabled: boolean;
  times: { label: string; time: string }[]; // "HH:MM"
  /** Skip reminders that fall inside low-appetite medication windows. */
  respectLowAppetiteWindows: boolean;
}

/** Bound on stored history (a year of weeks) so the document stays small. */
export const MAX_PLAN_HISTORY = 52;

export interface UserData {
  version: 1;
  preferences: Preferences;
  safeMeals: SafeMeal[];
  planHistory: WeekPlan[];
  freezer: FreezerItem[];
  reminders: ReminderSettings;
  updatedAt: string; // ISO
}
