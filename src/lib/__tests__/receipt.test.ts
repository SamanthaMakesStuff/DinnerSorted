import { describe, expect, it } from "vitest";
import { cleanReceiptLine, parseReceiptText } from "../receipt";

const TESCO_STYLE = `
Order summary
Order number: 1234567890
Delivered Saturday 5 July 2025

2 x Heinz Baked Beans 415g £1.90
Hovis Soft White Medium Bread 800g £1.15
Tesco Cheddar Cheese 350g £2.85
Birds Eye 12 Fish Fingers 336g £2.50
Fairy Washing Up Liquid 654ml £1.50
Andrex Toilet Roll 9 Pack £4.75
Whiskas Cat Food Pouches in Jelly £3.25
Carrier bag charge £0.40
Bananas Loose 1.2kg @ £0.78 each
Substituted: Tesco Penne 500g
Clubcard points earned 42
Subtotal £18.30
Delivery charge £3.00
Total £21.30
Paid by Visa ending 1234
`;

const OCR_STYLE = `
MORRISONS
STORE 218 TEL: 0345 611 6111
BEANS HEINZ 415G 0.95
BREAD HOVIS 800G 1.15
CHEDDAR EXTRA MATURE 2.85
KITCHEN ROLL 2PK 1.20
CHANGE 0.05
TOTAL 6.15
VISA CONTACTLESS
THANK YOU FOR SHOPPING
`;

describe("cleanReceiptLine", () => {
  it("strips quantities, prices and decorations", () => {
    expect(cleanReceiptLine("2 x Heinz Baked Beans 415g £1.90")).toBe(
      "Heinz Baked Beans 415g"
    );
    expect(cleanReceiptLine("Bananas Loose 1.2kg @ £0.78 each")).toBe(
      "Bananas Loose 1.2kg"
    );
    expect(cleanReceiptLine("BEANS HEINZ 415G 0.95")).toBe("BEANS HEINZ 415G");
    expect(cleanReceiptLine("• Pesto 190g £1.10 *")).toBe("Pesto 190g");
  });
});

describe("parseReceiptText", () => {
  it("keeps food items and strips prices", () => {
    const { food } = parseReceiptText(TESCO_STYLE);
    expect(food).toContain("Heinz Baked Beans 415g");
    expect(food).toContain("Hovis Soft White Medium Bread 800g");
    expect(food).toContain("Birds Eye 12 Fish Fingers 336g");
    expect(food).toContain("Bananas Loose 1.2kg");
  });

  it("drops totals, payment, loyalty and delivery lines outright", () => {
    const { food, removed } = parseReceiptText(TESCO_STYLE);
    const everything = [...food, ...removed.map((r) => r.name)].join("\n");
    expect(everything).not.toMatch(/total/i);
    expect(everything).not.toMatch(/visa/i);
    expect(everything).not.toMatch(/clubcard/i);
    expect(everything).not.toMatch(/order number/i);
    expect(everything).not.toMatch(/substituted/i);
    expect(everything).not.toMatch(/delivery/i);
  });

  it("moves non-food items to removed with a reason", () => {
    const { food, removed } = parseReceiptText(TESCO_STYLE);
    const removedNames = removed.map((r) => r.name.toLowerCase());
    expect(removedNames.some((n) => n.includes("fairy washing up"))).toBe(true);
    expect(removedNames.some((n) => n.includes("toilet roll"))).toBe(true);
    expect(removedNames.some((n) => n.includes("cat food"))).toBe(true);
    expect(removedNames.some((n) => n.includes("carrier bag"))).toBe(true);
    for (const f of food) {
      expect(f.toLowerCase()).not.toContain("toilet");
      expect(f.toLowerCase()).not.toContain("washing up");
    }
    const catFood = removed.find((r) => /cat food/i.test(r.name));
    expect(catFood?.reason).toBe("pet product");
  });

  it("handles till-style OCR text in capitals", () => {
    const { food, removed } = parseReceiptText(OCR_STYLE);
    expect(food).toContain("BEANS HEINZ 415G");
    expect(food).toContain("CHEDDAR EXTRA MATURE");
    expect(removed.some((r) => /KITCHEN ROLL/i.test(r.name))).toBe(true);
    const all = [...food, ...removed.map((r) => r.name)].join("\n");
    expect(all).not.toMatch(/morrisons|total|change|visa|thank you|tel/i);
  });

  it("dedupes repeated items", () => {
    const { food } = parseReceiptText("Milk 2 pint £1.20\nMilk 2 pint £1.20");
    expect(food).toEqual(["Milk 2 pint"]);
  });
});
