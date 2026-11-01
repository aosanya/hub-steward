import { vi } from "vitest";
import { isReady, notPassedRows, type PublishState } from "./publishData";
import type { Scenario } from "../../data/scenario";

vi.mock("../../data/draft", () => ({ loadDraft: vi.fn(), publishDraft: vi.fn(), listPublished: vi.fn().mockResolvedValue([]) }));
vi.mock("../../data/scenario", () => ({ loadScenarios: vi.fn() }));

const state = (notPassed: Scenario[], draftId = "d1", changes = 1): PublishState =>
  ({ draftId, changes: Array.from({ length: changes }, (_, i) => ({ id: String(i) })) as never, notPassed, published: [] });

describe("publishing with scenarios that have not passed", () => {
  it("is still ready, because the warning never blocks", () => {
    expect(isReady(state([{ id: "s1", result: "failed" } as Scenario]))).toBe(true);
  });

  it("is not ready without an open draft or without changes", () => {
    expect(isReady(state([], ""))).toBe(false);
    expect(isReady(state([], "d1", 0))).toBe(false);
  });

  it("lists each scenario that has not passed with its result", async () => {
    const { loadDraft } = await import("../../data/draft");
    const { loadScenarios } = await import("../../data/scenario");
    vi.mocked(loadDraft).mockResolvedValue({ draft: { id: "d1" }, changes: [] } as never);
    vi.mocked(loadScenarios).mockResolvedValue([
      { id: "s1", name: "A", result: "passed" },
      { id: "s2", name: "B", result: "failed" },
    ] as never);
    expect(await notPassedRows("h1")).toEqual([{ id: "s2", name: "B", result: "failed" }]);
  });
});
