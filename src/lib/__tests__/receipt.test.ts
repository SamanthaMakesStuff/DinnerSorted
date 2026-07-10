import { describe, expect, it } from "vitest";
import {
  cleanReceiptLine,
  parseReceiptLine,
  parseReceiptText,
} from "../receipt";

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

const PDF_STYLE = `
Dear Samantha
Thanks for shopping with us — here is a summary of what we brought to you today.
We hope you enjoy everything in your order and we look forward to seeing you again soon.
Groceries
Heinz Baked Beans 415g £0.95
Hovis Soft White Bread 800g £1.15
Yeo Valley Butter 200g £2.10
McCain Oven Chips 900g £2.25
Strawberries 400g £2.50
If you have any questions about this order you can visit our help centre at any time.
`;

describe("parseReceiptLine", () => {
  it("captures the price against the item", () => {
    expect(parseReceiptLine("Hovis Bread 800g £1.15")).toEqual({
      name: "Hovis Bread 800g",
      price: 1.15,
      qty: 1,
    });
  });

  it("divides a line price across a leading quantity", () => {
    expect(parseReceiptLine("2 x Heinz Baked Beans 415g £1.90")).toEqual({
      name: "Heinz Baked Beans 415g",
      price: 0.95,
      qty: 2,
    });
  });

  it("uses the unit price for weight-priced lines", () => {
    const p = parseReceiptLine("Bananas Loose 1.2kg @ £0.78 each");
    expect(p.name).toBe("Bananas Loose 1.2kg");
    expect(p.price).toBe(0.78);
  });

  it("takes the final price column from till-style lines", () => {
    expect(parseReceiptLine("BEANS HEINZ 415G 0.95").price).toBe(0.95);
  });

  it("returns null price when the line has none", () => {
    expect(parseReceiptLine("Cheese toastie").price).toBeNull();
  });
});

describe("cleanReceiptLine", () => {
  it("strips quantities, prices and decorations", () => {
    expect(cleanReceiptLine("2 x Heinz Baked Beans 415g £1.90")).toBe(
      "Heinz Baked Beans 415g"
    );
    expect(cleanReceiptLine("• Pesto 190g £1.10 *")).toBe("Pesto 190g");
  });
});

describe("parseReceiptText", () => {
  it("keeps food items with their prices", () => {
    const { food } = parseReceiptText(TESCO_STYLE);
    expect(food).toContainEqual({ name: "Heinz Baked Beans 415g", price: 0.95 });
    expect(food).toContainEqual({
      name: "Hovis Soft White Medium Bread 800g",
      price: 1.15,
    });
    expect(food).toContainEqual({ name: "Bananas Loose 1.2kg", price: 0.78 });
  });

  it("drops totals, payment, loyalty and delivery lines outright", () => {
    const { food, removed } = parseReceiptText(TESCO_STYLE);
    const everything = [
      ...food.map((f) => f.name),
      ...removed.map((r) => r.name),
    ].join("\n");
    expect(everything).not.toMatch(/total|visa|clubcard|order number|substituted|delivery/i);
  });

  it("moves non-food items to removed with a reason and price", () => {
    const { removed } = parseReceiptText(TESCO_STYLE);
    const catFood = removed.find((r) => /cat food/i.test(r.name));
    expect(catFood?.reason).toBe("pet product");
    expect(catFood?.price).toBe(3.25);
    expect(removed.some((r) => /toilet roll/i.test(r.name))).toBe(true);
    expect(removed.some((r) => /carrier bag/i.test(r.name))).toBe(true);
  });

  it("handles till-style OCR text in capitals", () => {
    const { food, removed } = parseReceiptText(OCR_STYLE);
    expect(food).toContainEqual({ name: "BEANS HEINZ 415G", price: 0.95 });
    expect(removed.some((r) => /KITCHEN ROLL/i.test(r.name))).toBe(true);
    const all = [...food.map((f) => f.name), ...removed.map((r) => r.name)].join("\n");
    expect(all).not.toMatch(/morrisons|total|change|visa|thank you|tel/i);
  });

  it("PDF-style: greetings and prose never reach the selection list", () => {
    const { food, removed } = parseReceiptText(PDF_STYLE);
    const names = [...food.map((f) => f.name), ...removed.map((r) => r.name)];
    expect(food).toContainEqual({ name: "Heinz Baked Beans 415g", price: 0.95 });
    expect(food).toContainEqual({ name: "Strawberries 400g", price: 2.5 });
    for (const n of names) {
      expect(n).not.toMatch(/dear|thanks|hope you|help centre|summary/i);
    }
    // unpriced section header "Groceries" dropped by price-anchoring
    expect(names).not.toContain("Groceries");
  });

  it("without price anchoring, short unpriced items still get through", () => {
    const { food } = parseReceiptText("Cheese toastie\nJacket potato");
    expect(food.map((f) => f.name)).toEqual(["Cheese toastie", "Jacket potato"]);
  });

  it("dedupes repeated items", () => {
    const { food } = parseReceiptText("Milk 2 pint £1.20\nMilk 2 pint £1.20");
    expect(food).toEqual([{ name: "Milk 2 pint", price: 1.2 }]);
  });
});
