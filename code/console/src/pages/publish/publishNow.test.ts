import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPublishState, publishNow } from "./publishData";

const draft = vi.hoisted(() => ({ loadDraft: vi.fn(), publishDraft: vi.fn(), listPublished: vi.fn() }));
const scenario = vi.hoisted(() => ({ loadScenarios: vi.fn() }));
const generated = vi.hoisted(() => ({ loadGenerated: vi.fn() }));

vi.mock("../../data/draft", () => draft);
vi.mock("../../data/scenario", () => scenario);
vi.mock("../../data/pages/generatedWorkflows", async (importOriginal) => ({ ...(await importOriginal<object>()), ...generated }));

const record = (code: string, name: string) => ({ id: code, key: code, code, name, itemName: "", heldBy: { add: [], edit: [], delete: [] } });

const made = (recordCode: string, action: string) => ({ id: recordCode + action, code: `${recordCode}.${action}`, name: action, action, record: record(recordCode, recordCode), heldBy: [], replacedBy: null });

const change = { id: "c1" };

beforeEach(() => {
  draft.loadDraft.mockReset();
  draft.publishDraft.mockReset();
  draft.listPublished.mockReset();
  scenario.loadScenarios.mockReset();
  draft.listPublished.mockResolvedValue([]);
  scenario.loadScenarios.mockResolvedValue([]);
  generated.loadGenerated.mockReset();
  generated.loadGenerated.mockResolvedValue({ workflows: [], records: [], designed: [], roleNames: new Map() });
});

describe("loading what the Publish page needs", () => {
  it("takes the open draft's id and changes, the scenarios that have not passed and the published versions", async () => {
    draft.loadDraft.mockResolvedValue({ draft: { id: "d1" }, changes: [change] });
    scenario.loadScenarios.mockResolvedValue([
      { id: "s1", name: "A", result: "passed" },
      { id: "s2", name: "B", result: "not run" },
    ]);
    draft.listPublished.mockResolvedValue([{ version: 2, tag: "v2", at: "", channel: "production" }]);
    const state = await loadPublishState("h1");
    expect(state.draftId).toBe("d1");
    expect(state.changes).toEqual([change]);
    expect(state.notPassed.map((one) => one.id)).toEqual(["s2"]);
    expect(state.published).toHaveLength(1);
  });

  it("has an empty draft id when no draft is open", async () => {
    draft.loadDraft.mockResolvedValue({ draft: null, changes: [] });
    expect((await loadPublishState("h1")).draftId).toBe("");
  });
});

describe("publishing from the Publish page", () => {
  it("publishes the open draft", async () => {
    draft.loadDraft.mockResolvedValue({ draft: { id: "d1" }, changes: [change] });
    draft.publishDraft.mockResolvedValue({ published: { version: 3, tag: "v3", at: "" } });
    expect(await publishNow("h1")).toEqual({ published: { version: 3, tag: "v3", at: "" } });
    expect(draft.publishDraft).toHaveBeenCalledWith("h1", "d1");
  });

  it("publishes a draft that has never been published even when no change is counted", async () => {
    draft.loadDraft.mockResolvedValue({ draft: { id: "d1" }, changes: [] });
    draft.publishDraft.mockResolvedValue({ published: { version: 1, tag: "v1", at: "" } });
    expect(await publishNow("h1")).toEqual({ published: { version: 1, tag: "v1", at: "" } });
    expect(draft.publishDraft).toHaveBeenCalledWith("h1", "d1");
  });

  it("refuses when a published draft has no counted changes and sends nothing", async () => {
    draft.listPublished.mockResolvedValue([{ version: 1, tag: "v1", at: "", channel: "production" }]);
    draft.loadDraft.mockResolvedValue({ draft: { id: "d1" }, changes: [] });
    await expect(publishNow("h1")).rejects.toThrow("the draft is not ready to publish");
    expect(draft.publishDraft).not.toHaveBeenCalled();
  });

  it("refuses when there is no open draft", async () => {
    draft.loadDraft.mockResolvedValue({ draft: null, changes: [change] });
    await expect(publishNow("h1")).rejects.toThrow("not ready");
    expect(draft.publishDraft).not.toHaveBeenCalled();
  });
});

describe("the generated workflows guard", () => {
  const set = (actions: string[]) => ({
    workflows: actions.map((action) => made("RC-2", action)),
    records: [record("RC-2", "Projects")],
    designed: [],
    roleNames: new Map(),
  });

  it("refuses to publish a record that lacks one of its three, names it and sends nothing", async () => {
    draft.loadDraft.mockResolvedValue({ draft: { id: "d1" }, changes: [change] });
    generated.loadGenerated.mockResolvedValue(set(["add", "edit"]));

    expect(await publishNow("h1")).toEqual({
      problems: [
        {
          message: "",
          word: "publish.generatedMissing",
          values: { record: "Projects", code: "RC-2", workflow: "RC-2.delete" },
          to: "/h/h1/records?record=RC-2",
          open: "generated.openRecord",
        },
      ],
    });
    expect(draft.publishDraft).not.toHaveBeenCalled();
  });

  it("publishes when every record has its three", async () => {
    draft.loadDraft.mockResolvedValue({ draft: { id: "d1" }, changes: [change] });
    draft.publishDraft.mockResolvedValue({ published: { version: 4, tag: "v4", at: "" } });
    generated.loadGenerated.mockResolvedValue(set(["add", "edit", "delete"]));

    expect(await publishNow("h1")).toEqual({ published: { version: 4, tag: "v4", at: "" } });
  });

  it("leaves the check to the server when the generated workflows cannot be read", async () => {
    draft.loadDraft.mockResolvedValue({ draft: { id: "d1" }, changes: [change] });
    draft.publishDraft.mockResolvedValue({ published: { version: 4, tag: "v4", at: "" } });
    generated.loadGenerated.mockRejectedValue(new Error("down"));

    expect(await publishNow("h1")).toEqual({ published: { version: 4, tag: "v4", at: "" } });
  });
});
