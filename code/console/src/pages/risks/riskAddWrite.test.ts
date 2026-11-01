import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { createPart, deletePathway, deleteRisk, unlinkPart } from "./riskAddWrite";

vi.mock("../../wakala/mcp");

const callsMade = () => vi.mocked(callTool).mock.calls.map(([, tool, args]) => [tool, args ?? {}]);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation((async (_hubId: string, tool: string) => {
    if (tool === "agency_list_drafts") return { items: [{ id: "d1", status: "open", description: "" }] };
    return { code: "Q-9" };
  }) as never);
});

describe("deleting risk parts sends only the id the tool takes", () => {
  it.each([
    ["agency_delete_risk", () => deleteRisk("h", "r1"), { risk_id: "r1" }],
    ["agency_delete_risk_pathway", () => deletePathway("h", "p1"), { risk_pathway_id: "p1" }],
    ["agency_delete_risk_threat", () => unlinkPart("h", "threat", "l1"), { risk_threat_id: "l1" }],
    ["agency_delete_risk_consequence", () => unlinkPart("h", "consequence", "l2"), { risk_consequence_id: "l2" }],
  ])("%s", async (tool, run, args) => {
    await run();
    expect(callsMade()).toEqual([[tool, args]]);
  });
});

describe("creating a library part", () => {
  it("sends the hazard to a consequence even when none is chosen", async () => {
    await createPart("h", "consequence", { title: " Flood ", description: "" });
    expect(callsMade()).toContainEqual(["agency_create_consequence", { draft_id: "d1", title: "Flood", description: "", hazard_code: "" }]);
  });

  it("sends the chosen hazard to a consequence", async () => {
    await createPart("h", "consequence", { title: "Flood", description: "", hazardCode: "H-1" });
    expect(callsMade()).toContainEqual(["agency_create_consequence", { draft_id: "d1", title: "Flood", description: "", hazard_code: "H-1" }]);
  });

  it("sends no hazard to a threat", async () => {
    await createPart("h", "threat", { title: "Flood", description: "", hazardCode: "H-1" });
    expect(callsMade()).toContainEqual(["agency_create_threat", { draft_id: "d1", title: "Flood", description: "" }]);
  });
});
