import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPublishState, publishNow } from "./publishData";

const draft = vi.hoisted(() => ({ loadDraft: vi.fn(), publishDraft: vi.fn(), listPublished: vi.fn() }));
const scenario = vi.hoisted(() => ({ loadScenarios: vi.fn() }));

vi.mock("../../data/draft", () => draft);
vi.mock("../../data/scenario", () => scenario);

const change = { id: "c1" };

beforeEach(() => {
  draft.loadDraft.mockReset();
  draft.publishDraft.mockReset();
  draft.listPublished.mockReset();
  scenario.loadScenarios.mockReset();
  draft.listPublished.mockResolvedValue([]);
  scenario.loadScenarios.mockResolvedValue([]);
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

  it("refuses when the draft has no changes and sends nothing", async () => {
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
