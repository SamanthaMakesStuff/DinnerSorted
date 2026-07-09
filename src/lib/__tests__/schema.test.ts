import { describe, expect, it } from "vitest";
import { parseImportedJson } from "../schema";
import { defaultUserData } from "../defaults";

describe("parseImportedJson", () => {
  it("round-trips a real export", () => {
    const data = defaultUserData();
    const result = parseImportedJson(JSON.stringify(data));
    expect(result.ok).toBe(true);
    expect(result.data?.preferences.newFoodsOptIn).toBe(false);
  });

  it("rejects non-JSON with a plain-language error", () => {
    const result = parseImportedJson("not json at all {");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/isn't valid JSON/);
  });

  it("rejects JSON that isn't a DinnerSorted export", () => {
    const result = parseImportedJson(JSON.stringify({ foo: "bar" }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/doesn't look like a DinnerSorted export/);
  });

  it("rejects a wrong version number", () => {
    const data = { ...defaultUserData(), version: 2 };
    const result = parseImportedJson(JSON.stringify(data));
    expect(result.ok).toBe(false);
  });

  it("fills defaults for missing optional fields", () => {
    const data = defaultUserData() as unknown as Record<string, unknown>;
    delete data.freezer;
    delete data.reminders;
    const result = parseImportedJson(JSON.stringify(data));
    expect(result.ok).toBe(true);
    expect(result.data?.freezer).toEqual([]);
    expect(result.data?.reminders.enabled).toBe(false);
  });
});
