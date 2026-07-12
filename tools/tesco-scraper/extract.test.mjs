import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectCookingTools,
  extractCookingInstructions,
  extractIngredients,
  extractPortions,
  extractProductFromHtml,
  extractProductLinks,
  mapTextToAllergens,
} from "./extract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "307358055.html"),
  "utf8"
);
const URL = "https://www.tesco.com/groceries/en-GB/products/307358055";

describe("extractProductFromHtml", () => {
  const p = extractProductFromHtml(FIXTURE, URL, "Ready meals");

  it("reads name and price from JSON-LD", () => {
    expect(p.name).toBe("Tesco Chicken Tikka Masala & Pilau Rice 450G");
    expect(p.pricePence).toBe(385);
    expect(p.id).toBe("tesco:307358055");
  });

  it("captures ingredients text and detects allergens", () => {
    expect(p.ingredientsText).toContain("Chicken Breast");
    expect(p.allergens).toContain("Milk");
    expect(p.allergens).toContain("Cereals containing gluten");
    expect(p.allergens).not.toContain("Peanuts");
  });

  it("captures may-contain traces", () => {
    expect(p.mayContain).toEqual(["Mustard"]);
  });

  it("reads portions, size and microwave time", () => {
    expect(p.portions).toBe(1);
    expect(p.sizeText).toBe("450g");
    expect(p.cookMinutes).toBe(4); // microwave preferred over 25-min oven
  });

  it("captures cooking instructions and detects the tools used", () => {
    expect(p.cookingInstructions).toMatch(/Microwave 900W/);
    expect(p.cookingInstructions).toMatch(/Oven from chilled/);
    expect(p.cookTools).toContain("Microwave");
    expect(p.cookTools).toContain("Oven");
    expect(p.cookTools).not.toContain("Air fryer");
  });

  it("returns null for a non-product page", () => {
    expect(
      extractProductFromHtml("<html><body>hello</body></html>", URL)
    ).toBeNull();
  });
});

describe("extractProductLinks", () => {
  it("finds product links, absolute and query-stripped (old /groceries/ URLs)", () => {
    const links = extractProductLinks(FIXTURE);
    expect(links).toContain(
      "https://www.tesco.com/groceries/en-GB/products/300212345"
    );
    expect(links).toContain(
      "https://www.tesco.com/groceries/en-GB/products/301998877"
    );
  });

  it("reads the JSON-LD ItemList on a real category page (new /shop/ URLs)", () => {
    const categoryHtml = fs.readFileSync(
      path.join(__dirname, "fixtures", "category-readymeals.html"),
      "utf8"
    );
    const links = extractProductLinks(categoryHtml);
    expect(links).toContain(
      "https://www.tesco.com/shop/en-GB/products/266748693"
    );
    expect(links).toContain(
      "https://www.tesco.com/shop/en-GB/products/310672317"
    );
    expect(links.length).toBe(5);
  });
});

describe("extractIngredients", () => {
  it("strips a doubled Ingredients / INGREDIENTS: label (real Tesco layout)", () => {
    const text =
      "Product Description\nSomething tasty\nIngredients\n INGREDIENTS: Cooked Spaghetti Pasta [Water, Durum Wheat Semolina], Whole Milk.\nAllergy Information\nFor allergens see bold.";
    const out = extractIngredients(text);
    expect(out.startsWith("Cooked Spaghetti Pasta")).toBe(true);
    expect(out).not.toMatch(/INGREDIENTS:/i);
  });
});

describe("extractPortions", () => {
  it("reads a plain Serves N", () => {
    expect(extractPortions("Serves 2\nKeep refrigerated")).toBe(2);
  });
  it("reads servings-per-pack phrasing", () => {
    expect(extractPortions("2 servings per pack")).toBe(2);
    expect(extractPortions("Servings per pack: 3")).toBe(3);
  });
  it("infers from a 'Per ½ pack' nutrition heading", () => {
    expect(extractPortions("Typical values Per 100g Per ½ pack")).toBe(2);
  });
  it("returns null when there's no serving info", () => {
    expect(extractPortions("Keep refrigerated. Use by date on pack.")).toBeNull();
  });
});

describe("detectCookingTools", () => {
  it("detects microwave and oven from typical instructions", () => {
    const tools = detectCookingTools(
      "Microwave 900W: heat for 4 mins. Oven: 190°C for 25 mins."
    );
    expect(tools).toEqual(["Microwave", "Oven"]);
  });
  it("detects hob and grill", () => {
    expect(detectCookingTools("Empty into a saucepan on the hob")).toContain("Hob");
    expect(detectCookingTools("Place under a preheated grill")).toContain("Grill");
  });
  it("detects air fryer", () => {
    expect(detectCookingTools("Air fry at 200°C for 12 minutes")).toContain(
      "Air fryer"
    );
  });
  it("returns nothing for text with no method", () => {
    expect(detectCookingTools("Keep refrigerated. Serve cold.")).toEqual([]);
  });
});

describe("extractCookingInstructions", () => {
  it("captures the preparation section only", () => {
    const text =
      "Ingredients\n Chicken, rice.\nCooking Instructions\n Microwave 900W for 5 mins.\nStorage\n Keep refrigerated.";
    const out = extractCookingInstructions(text);
    expect(out).toMatch(/Microwave 900W/);
    expect(out).not.toMatch(/Keep refrigerated/);
  });
});

describe("mapTextToAllergens", () => {
  it("maps keywords to canonical UK-14 names", () => {
    expect(mapTextToAllergens("wheat flour, soya lecithin, prawns")).toEqual(
      expect.arrayContaining([
        "Cereals containing gluten",
        "Soybeans",
        "Crustaceans",
      ])
    );
  });
  it("finds nothing in clean text", () => {
    expect(mapTextToAllergens("rice, chicken, tomato, onion")).toEqual([]);
  });
});
