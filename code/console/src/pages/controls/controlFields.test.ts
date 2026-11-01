import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftScope } from "../../data/draft";
import { callTool } from "../../wakala/mcp";
import { blankFields, listWorkflowChoices, loadControlFields } from "./controlFields";

vi.mock("../../wakala/mcp");
vi.mock("../../data/draft");

const callToolMock = vi.mocked(callTool);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(draftScope).mockResolvedValue({ draft_id: "d1" });
});

describe("workflow choices for a control", () => {
  it("names a workflow by its name, then its code, in the working draft", async () => {
    callToolMock.mockResolvedValue([{ id: "w1", name: "Buy" }, { id: "w2", code: "W2" }, { id: "w3" }] as never);
    expect(await listWorkflowChoices("h")).toEqual([
      { id: "w1", name: "Buy" },
      { id: "w2", name: "W2" },
      { id: "w3", name: "" },
    ]);
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_list_workflows", { draft_id: "d1" });
  });

  it("is empty when there are none", async () => {
    callToolMock.mockResolvedValue(null as never);
    expect(await listWorkflowChoices("h")).toEqual([]);
  });
});

describe("loading a control's fields", () => {
  it("fills every field from the control with that id and leaves unknown ones blank", async () => {
    callToolMock.mockResolvedValue([{ id: "other", code: "C0", text: "no" }, { id: "c1", code: "C1", text: "Keep dry", action: "run_workflow", workflow_id: "w1", cond_value: 5, extra: "x" }] as never);
    const loaded = await loadControlFields("h", "c1");
    expect(loaded?.code).toBe("C1");
    expect(loaded?.fields).toEqual({ ...blankFields, text: "Keep dry", action: "run_workflow", workflow_id: "w1" });
  });

  it("is null when no control has that id", async () => {
    callToolMock.mockResolvedValue([{ id: "a" }] as never);
    expect(await loadControlFields("h", "zzz")).toBeNull();
  });

  it("does not share one set of blank fields between loads", async () => {
    callToolMock.mockResolvedValue([{ id: "c1", text: "A" }] as never);
    await loadControlFields("h", "c1");
    expect(blankFields.text).toBe("");
  });

  it("is null when the answer is not a list", async () => {
    callToolMock.mockResolvedValue("x" as never);
    expect(await loadControlFields("h", "c1")).toBeNull();
  });
});
