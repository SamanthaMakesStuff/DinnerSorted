import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
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
