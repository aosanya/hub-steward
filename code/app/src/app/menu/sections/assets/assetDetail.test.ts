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

describe("the maintenance history of an asset", () => {
  const historyKeys = ["maintenance0", "maintenance1", "maintenance2", "maintenance3", "maintenance4"];

  const job = (id: string, title: string, linked: string, completed: string, rest: Record<string, string> = { state: "Done", status: "completed" }) => ({
    id,
    title,
    linked_ref: linked,
    completed_at: completed,
    ...rest,
  });

  const jobs = [
    job("j1", "Grease the roller hydraulics", "e1", "2026-11-03T09:30:00Z"),
    job("j2", "Replace the roller drum bearings", "e1", "2026-11-10T14:00:00Z", { state: "Done" }),
    job("j3", "Inspect the roller exhaust", "e1", "", { state: "In progress", status: "in_progress" }),
    job("j4", "Flush the pump housing", "e2", "2026-11-12T10:00:00Z"),
    job("j5", "Change the roller filters", "e1", "2026-10-27T08:00:00Z", { status: "completed" }),
    { id: "j6", title: "Clear the gutters", state: "Done", status: "completed", completed_at: "2026-11-11T08:00:00Z" },
  ];

  const sixFinished = [
    job("s1", "Clean the roller scraper bars", "e1", "2026-09-29T08:00:00Z"),
    job("s2", "Replace the roller seals", "e1", "2026-10-06T08:00:00Z"),
    job("s3", "Test the roller brakes", "e1", "2026-10-13T08:00:00Z"),
    job("s4", "Oil the roller joints", "e1", "2026-10-20T08:00:00Z"),
    job("s5", "Repaint the roller frame", "e1", "2026-10-27T08:00:00Z"),
    job("s6", "Swap the roller tyres", "e1", "2026-11-03T08:00:00Z"),
  ];

  let calls: string[] = [];

  const load = async (listed: Record<string, unknown>[]) => {
    calls = [];
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
      calls.push(name);
      const actors = answerActors(name, args);
      if (actors) return actors;
      if (name === "assetmanager_asset_read") return { item: { id: "e1", name: "Road roller" } };
      if (name === "assetmanager_movement_list") return { items: [] };
      if (name === "taskmanager_task_list") return { items: listed };
      return {};
    });
    return loadAsset("e1");
  };

  const shownHistory = (loaded: Record<string, unknown>) => historyKeys.map((key) => loaded[key] ?? "");

  it("labels the rows Maintenance history, after the movement rows, each reading one loaded key", () => {
    const entries = Object.entries(assetDetailFields);
    const labels = entries.map(([label]) => label);

    expect(entries.slice(-5).map(([, key]) => key)).toEqual(historyKeys);
    expect(entries.slice(-5)[0][0]).toBe("Maintenance history");
    expect(labels.indexOf("Maintenance history")).toBeGreaterThan(labels.indexOf("Earlier"));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("carries the finished jobs of that asset, newest first, each with its title and the day it was finished", async () => {
    const loaded = await load(jobs);

    expect(shownHistory(loaded)).toEqual([
      "Replace the roller drum bearings · Tuesday, 10 Nov",
      "Grease the roller hydraulics · Tuesday, 3 Nov",
      "Change the roller filters · Tuesday, 27 Oct",
      "",
      "",
    ]);
  });

  it("leaves out an open job of the asset and a finished job of another asset or of none", async () => {
    const loaded = await load(jobs);

    const shown = shownHistory(loaded).join("|");
    expect(shown).not.toContain("Inspect the roller exhaust");
    expect(shown).not.toContain("Flush the pump housing");
    expect(shown).not.toContain("Clear the gutters");
  });

  it("keeps only the newest five of six finished jobs, however the list is ordered", async () => {
    const loaded = await load([sixFinished[2], sixFinished[5], sixFinished[0], sixFinished[4], sixFinished[1], sixFinished[3]]);

    expect(shownHistory(loaded)).toEqual([
      "Swap the roller tyres · Tuesday, 3 Nov",
      "Repaint the roller frame · Tuesday, 27 Oct",
      "Oil the roller joints · Tuesday, 20 Oct",
      "Test the roller brakes · Tuesday, 13 Oct",
      "Replace the roller seals · Tuesday, 6 Oct",
    ]);
    expect(Object.values(loaded).join("|")).not.toContain("Clean the roller scraper bars");
  });

  it("reads the task list once, not once per job", async () => {
    await load(sixFinished);

    expect(calls.filter((name) => name === "taskmanager_task_list")).toHaveLength(1);
    expect(calls.filter((name) => name === "taskmanager_task_read")).toHaveLength(0);
  });

  it.each([
    ["no tasks at all", []],
    ["only open jobs of the asset", [jobs[2]]],
    ["only finished jobs of other assets", [jobs[3], jobs[5]]],
  ])("puts no history on an asset with %s, and still loads it", async (_case, listed) => {
    const loaded = await load(listed);

    expect(loaded).toMatchObject({ id: "e1", name: "Road roller" });
    expect(shownHistory(loaded)).toEqual(["", "", "", "", ""]);
  });
});
