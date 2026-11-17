import { vi } from "vitest";
import * as mcp from "../../../../shared/wakala/mcp";
import { answerActors } from "./keeperActors";
import { assetDetailFields, attributeKeys, attributesOf, conditionWords, loadAsset, withAttributes } from "./assetDetail";

afterEach(() => vi.restoreAllMocks());

describe("attributesOf", () => {
  it("returns the parsed object", () => {
    expect(attributesOf({ attributes_json: '{"condition":"Fair","warranty":"2027"}' })).toEqual({ condition: "Fair", warranty: "2027" });
  });

  it.each([[{}], [{ attributes_json: "" }], [{ attributes_json: undefined }], [{ attributes_json: 7 }]])("returns an empty object for %j", (asset) => {
    expect(attributesOf(asset)).toEqual({});
  });

  it.each([["not json"], ["[1]"], ['"Fair"'], ["null"], ["12"]])("returns null for the text %s", (text) => {
    expect(attributesOf({ attributes_json: text })).toBeNull();
  });
});

describe("withAttributes", () => {
  it("merges the changes and keeps the other keys", () => {
    const text = withAttributes({ attributes_json: '{"condition":"Fair","warranty":"2027"}' }, { condition: "Poor" });

    expect(JSON.parse(text)).toEqual({ condition: "Poor", warranty: "2027" });
  });

  it("builds the text from nothing when the asset has no attributes", () => {
    expect(JSON.parse(withAttributes({}, { condition: "Good" }))).toEqual({ condition: "Good" });
  });

  it("returns the same raw text when the changes are empty", () => {
    const raw = '{ "condition": "Fair",  "warranty": "2027" }';

    expect(withAttributes({ attributes_json: raw }, {})).toBe(raw);
  });

  it("returns the raw text when the attributes are not an object", () => {
    expect(withAttributes({ attributes_json: "not json" }, { condition: "Poor" })).toBe("not json");
    expect(withAttributes({ attributes_json: "[1]" }, { condition: "Poor" })).toBe("[1]");
  });
});

describe("the condition vocabulary", () => {
  it("keeps the condition under one attribute key", () => {
    expect(attributeKeys).toContain("condition");
  });

  it("lists the four words in order", () => {
    expect(conditionWords).toEqual(["Good", "Fair", "Poor", "Out of use"]);
  });

  it("shows Condition in the detail rows after Category", () => {
    expect(Object.entries(assetDetailFields)).toContainEqual(["Condition", "condition"]);
    const labels = Object.keys(assetDetailFields);
    expect(labels.indexOf("Condition")).toBe(labels.indexOf("Category") + 1);
  });
});

describe("loadAsset", () => {
  const load = async (asset: Record<string, unknown>) => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
      const actors = answerActors(name, args);
      if (actors) return actors;
      if (name === "assetmanager_asset_read") return { item: asset };
      if (name === "assetmanager_movement_list") return { items: [] };
      return {};
    });
    return loadAsset("e1");
  };

  it("puts the condition word under condition on the loaded item", async () => {
    const loaded = await load({ id: "e1", name: "Road roller", attributes_json: '{"condition":"Poor","warranty":"2027"}' });

    expect(loaded).toMatchObject({ id: "e1", condition: "Poor" });
  });

  it.each([
    ["no attributes", {}],
    ["empty attributes", { attributes_json: "{}" }],
    ["text that is not JSON", { attributes_json: "not json" }],
    ["a condition that is not text", { attributes_json: '{"condition":3}' }],
  ])("puts an empty condition on an asset with %s", async (_case, extra) => {
    const loaded = await load({ id: "e1", name: "Road roller", ...extra });

    expect(loaded).toHaveProperty("condition", "");
  });
});

describe("the keeper of an asset", () => {
  const keeperLabel = "Kept by";

  const keeperShown = (loaded: Record<string, unknown>) => loaded[assetDetailFields[keeperLabel as keyof typeof assetDetailFields]];

  const load = async (asset: Record<string, unknown>) => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
      const actors = answerActors(name, args);
      if (actors) return actors;
      if (name === "assetmanager_asset_read") return { item: asset };
      if (name === "assetmanager_movement_list") return { items: [] };
      return {};
    });
    return loadAsset("e1");
  };

  it("is one more attribute key beside the condition", () => {
    expect(attributeKeys).toContain("keeper");
    expect(attributeKeys).toContain("condition");
  });

  it("shows Kept by in the detail rows right after Condition", () => {
    const labels = Object.keys(assetDetailFields);

    expect(labels).toContain(keeperLabel);
    expect(labels.indexOf(keeperLabel)).toBe(labels.indexOf("Condition") + 1);
  });

  it("keeps the other keys when the keeper is set", () => {
    const text = withAttributes({ attributes_json: '{"condition":"Fair","warranty":"2027"}' }, { keeper: "g1" });

    expect(JSON.parse(text)).toEqual({ condition: "Fair", warranty: "2027", keeper: "g1" });
  });

  it("puts the name of a person keeper on the loaded item", async () => {
    const loaded = await load({ id: "e1", name: "Road roller", attributes_json: '{"keeper":"p2"}' });

    expect(keeperShown(loaded)).toBe("Gábor Horváth");
  });

  it("puts the name of a group keeper on the loaded item", async () => {
    const loaded = await load({ id: "e1", name: "Road roller", attributes_json: '{"condition":"Fair","keeper":"g3"}' });

    expect(keeperShown(loaded)).toBe("Public Works Department");
    expect(loaded).toMatchObject({ condition: "Fair" });
  });

  it.each([
    ["no attributes", {}],
    ["no keeper", { attributes_json: '{"condition":"Fair"}' }],
    ["an empty keeper", { attributes_json: '{"keeper":""}' }],
    ["a keeper that is not text", { attributes_json: '{"keeper":3}' }],
    ["a keeper id that is nobody", { attributes_json: '{"keeper":"zz9"}' }],
    ["text that is not JSON", { attributes_json: "not json" }],
  ])("puts no keeper name on an asset with %s, and still loads it", async (_case, extra) => {
    const loaded = await load({ id: "e1", name: "Road roller", ...extra });

    expect(loaded).toMatchObject({ id: "e1", name: "Road roller" });
    expect(keeperShown(loaded) ?? "").toBe("");
  });
});
