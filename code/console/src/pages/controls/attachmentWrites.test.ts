import { beforeEach, describe, expect, it, vi } from "vitest";
import { listConsequences, listThreats } from "../../data/pages/library";
import { callTool } from "../../wakala/mcp";
import { attachPart, detachPart, loadAttachments } from "./attachmentWrites";

vi.mock("../../wakala/mcp");
vi.mock("../../data/pages/library");

const callToolMock = vi.mocked(callTool);

const part = (id: string, code: string, title: string) => ({ id, code, title, description: "" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listThreats).mockResolvedValue([part("t1", "T1", "Flood"), part("t2", "T2", "Fire")]);
  vi.mocked(listConsequences).mockResolvedValue([part("c1", "C1", "Loss"), part("t1", "T1", "Same code as a threat")]);
});

describe("what a control is attached to", () => {
  it("names each attachment by its part's title and offers the parts not yet attached", async () => {
    callToolMock.mockResolvedValue([{ id: "a1", target_type: "threat", target_code: "T1" }, { id: "a2", target_type: "consequence", target_code: "C1" }] as never);
    const state = await loadAttachments("h", "ctl");
    expect(state.attached).toEqual([
      { id: "a1", kind: "threat", title: "Flood" },
      { id: "a2", kind: "consequence", title: "Loss" },
    ]);
    expect(state.choices.map((c) => c.value)).toEqual(["threat:t2", "consequence:t1"]);
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_list_control_attachments", { control_id: "ctl" });
  });

  it("keeps a threat and a consequence with the same code apart", async () => {
    callToolMock.mockResolvedValue([{ id: "a1", target_type: "threat", target_code: "T1" }] as never);
    const state = await loadAttachments("h", "ctl");
    expect(state.attached[0].title).toBe("Flood");
    expect(state.choices.map((c) => c.value)).toContain("consequence:t1");
    expect(state.choices.map((c) => c.value)).not.toContain("threat:t1");
  });

  it("falls back to the code for a part that is gone and skips targets of another kind", async () => {
    callToolMock.mockResolvedValue([{ id: "a1", target_type: "threat", target_code: "T9" }, { id: "a2", target_type: "hazard", target_code: "H1" }, { id: "a3" }] as never);
    const state = await loadAttachments("h", "ctl");
    expect(state.attached).toEqual([{ id: "a1", kind: "threat", title: "T9" }]);
    expect(state.choices).toHaveLength(4);
  });

  it("offers everything when nothing is attached and nothing when there are no parts", async () => {
    callToolMock.mockResolvedValue(null as never);
    expect((await loadAttachments("h", "ctl")).choices).toHaveLength(4);
    vi.mocked(listThreats).mockResolvedValue([]);
    vi.mocked(listConsequences).mockResolvedValue([]);
    expect(await loadAttachments("h", "ctl")).toEqual({ attached: [], choices: [] });
  });

  it("fails when a list cannot be read", async () => {
    callToolMock.mockResolvedValue([] as never);
    vi.mocked(listThreats).mockRejectedValue(new Error("down"));
    await expect(loadAttachments("h", "ctl")).rejects.toThrow("down");
  });
});

describe("attaching and detaching", () => {
  it("attaches by the part's id and kind", async () => {
    callToolMock.mockResolvedValue({} as never);
    await attachPart("h", "ctl", { value: "threat:t2", kind: "threat", id: "t2", title: "Fire" });
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_attach_control", { control_id: "ctl", target_type: "threat", target_id: "t2" });
  });

  it("detaches by attachment id", async () => {
    callToolMock.mockResolvedValue({} as never);
    await detachPart("h", "a1");
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_detach_control", { attachment_id: "a1" });
  });

  it("lets a refusal through", async () => {
    callToolMock.mockRejectedValue(new Error("no"));
    await expect(attachPart("h", "ctl", { value: "", kind: "threat", id: "t", title: "" })).rejects.toThrow("no");
    await expect(detachPart("h", "a")).rejects.toThrow("no");
  });
});
