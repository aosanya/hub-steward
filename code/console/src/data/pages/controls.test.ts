import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { attachControl, controlsPage, createControl, deleteControl, detachControl, listControls, updateControl } from "./controls";

vi.mock("../../wakala/mcp");

const controls = [
  { id: "c1", code: "C-1", text: "Advice only" },
  { id: "c2", code: "C-2", text: "Hide figures", action: "Hide the figures", on_breach: "flag", severity: "medium" },
  { id: "c3", code: "C-3", text: "Tested one", strength: "tested", action: "Block", on_breach: "block", severity: "high" },
];

const attachments: Record<string, unknown> = {
  c1: { items: [] },
  c2: { items: [{ id: "a1", target_type: "role", target_code: "R-1" }, { id: "a2", target_type: "threat", target_code: "T-2" }] },
  c3: { items: [{ id: "a3", target_type: "goal", target_code: "G-1" }] },
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation((async (_hubId: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === "agency_list_drafts") return { items: [] };
    if (tool === "agency_list_controls") return { items: controls };
    if (tool === "agency_list_control_attachments") return attachments[String(args.control_id)];
    return {};
  }) as never);
});

describe("the controls page", () => {
  it("names its tools, primary and columns", () => {
    expect(controlsPage.spec.id).toBe("controls");
    expect(controlsPage.spec.title).toBe("Controls");
    expect(controlsPage.spec.primary).toBe("Add a control");
    expect(controlsPage.spec.columns.map((column) => column.label)).toEqual(["Code", "Text", "Strength", "Action", "On breach", "Severity", "Attached to"]);
    expect(controlsPage.spec.tools).toContain("agency_attach_control");
  });

  it("lists controls with strength and where each is attached", async () => {
    expect(await controlsPage.rows("h1", { draft_id: "d1" })).toEqual([
      { id: "c1", code: "C-1", text: "Advice only", strength: "advisory", action: "", on_breach: "", severity: "", attached_to: "" },
      { id: "c2", code: "C-2", text: "Hide figures", strength: "enforced", action: "Hide the figures", on_breach: "flag", severity: "medium", attached_to: "role R-1, threat T-2" },
      { id: "c3", code: "C-3", text: "Tested one", strength: "tested", action: "Block", on_breach: "block", severity: "high", attached_to: "goal G-1" },
    ]);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_list_controls", { draft_id: "d1" });
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_list_control_attachments", { control_id: "c2" });
    expect((await listControls("h1", { draft_id: "d1" }))[1].attachedTo).toBe("role R-1, threat T-2");
  });

  it("creates a control in the draft", async () => {
    expect(await createControl("h1", { draft_id: "d1", code: "C-9", text: " New ", action: "Hide", on_breach: "flag", severity: "low" })).toBe("done");
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_create_control", {
      draft_id: "d1", code: "C-9", text: "New", action: "Hide", cond_field: "", cond_operator: "", cond_value: "", on_breach: "flag", workflow_id: "", severity: "low",
    });
    await expect(createControl("h1", { draft_id: "d1" })).rejects.toThrow("text is required");
  });

  it("updates, deletes, attaches and detaches by id", async () => {
    await updateControl("h1", { control_id: "c2", text: "Rewritten" });
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_update_control", expect.objectContaining({ control_id: "c2", text: "Rewritten" }));
    await deleteControl("h1", { control_id: "c2" });
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_delete_control", { control_id: "c2" });
    await attachControl("h1", { control_id: "c1", target_type: "role", target_id: "r1" });
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_attach_control", { control_id: "c1", target_type: "role", target_id: "r1" });
    await detachControl("h1", { control_id: "c1", attachment_id: "a1" });
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_detach_control", { attachment_id: "a1" });
    await expect(attachControl("h1", { control_id: "c1" })).rejects.toThrow("target_type is required");
    await expect(detachControl("h1", { control_id: "c1" })).rejects.toThrow("attachment_id is required");
  });
});
