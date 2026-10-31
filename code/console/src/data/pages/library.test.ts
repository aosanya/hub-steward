import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import {
  consequenceRows,
  consequencesPage,
  createConsequence,
  createHazard,
  createThreat,
  deleteHazard,
  deleteThreat,
  hazardRows,
  hazardsPage,
  linkConsequence,
  linkThreat,
  listLibraryControls,
  threatRows,
  threatsPage,
  unlinkConsequence,
  unlinkThreat,
  updateConsequence,
  updateHazard,
} from "./library";

vi.mock("../../wakala/mcp");

const scope = { draft_id: "d1" };

const replies: Record<string, unknown> = {
  agency_list_hazards: { items: [{ id: "h1", code: "H-1", title: "Flood", description: "Water" }] },
  agency_list_risks: { items: [{ code: "RK-1", hazard_code: "H-1" }, { code: "RK-2", hazard_code: "H-1" }, { code: "RK-3" }] },
  agency_list_threats: { items: [{ id: "t1", code: "T-1", title: "No buyer" }, { id: "t2", code: "T-2", title: "Late truck" }] },
  agency_list_consequences: { items: [{ id: "q1", code: "Q-1", title: "Crops rot", hazard_code: "H-1" }] },
  agency_list_risk_threats: { items: [{ risk_code: "RK-1", threat_code: "T-1" }, { risk_code: "RK-1", threat_code: "T-1" }, { risk_code: "RK-2", threat_code: "T-1" }] },
  agency_list_risk_consequences: { items: [{ risk_code: "RK-1", consequence_code: "Q-1" }] },
  agency_list_unguarded_parts: [{ kind: "threat", code: "T-2", title: "Late truck", uses: 0, bowties: [] }],
  agency_list_controls: { items: [{ id: "c1", code: "C-1", text: "Pre-sell" }] },
  agency_list_control_attachments: { items: [{ target_type: "threat", target_code: "T-1" }, { target_type: "risk_pathway", target_code: "RP-1" }] },
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => replies[tool] as never);
});

describe("the three library pages", () => {
  it("are hazards, threats and consequences with their columns and primaries", () => {
    expect([hazardsPage, threatsPage, consequencesPage].map((page) => [page.spec.id, page.spec.title, page.spec.primary])).toEqual([
      ["hazards", "Hazards", "Add a hazard"],
      ["threats", "Threats", "Add a threat"],
      ["consequences", "Consequences", "Add a consequence"],
    ]);
    expect(hazardsPage.spec.columns.map((column) => column.label)).toEqual(["Code", "Title", "Used in"]);
    expect(threatsPage.spec.columns.map((column) => column.label)).toEqual(["Code", "Title", "Used in", "Controls"]);
    expect(consequencesPage.spec.columns).toEqual(threatsPage.spec.columns);
  });

  it("counts hazard use by distinct risks naming it", async () => {
    expect(await hazardRows("h", scope)).toEqual([{ id: "h1", code: "H-1", title: "Flood", description: "Water", usedIn: 2, controls: "" }]);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h", "agency_list_hazards", scope);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h", "agency_list_risks", scope);
  });

  it("counts threat use by distinct risks and flags unguarded ones once", async () => {
    const built = await threatRows("h", scope);
    expect(built.map((row) => [row.code, row.usedIn, row.unguarded, row.controls])).toEqual([
      ["T-1", 2, false, ""],
      ["T-2", 0, true, "No controls"],
    ]);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h", "agency_list_risk_threats", scope);
    expect(vi.mocked(callTool).mock.calls.filter(([, tool]) => tool === "agency_list_unguarded_parts")).toHaveLength(1);
  });

  it("reads consequences the same way", async () => {
    const built = await consequenceRows("h", scope);
    expect(built[0]).toMatchObject({ code: "Q-1", usedIn: 1, unguarded: false, hazardCode: "H-1", hazardTitle: "Flood" });
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h", "agency_list_risk_consequences", scope);
  });

  it("lists controls with their threat and consequence attachments only", async () => {
    expect(await listLibraryControls("h", scope)).toEqual([{ id: "c1", code: "C-1", title: "Pre-sell", usedIn: 1, controls: "T-1" }]);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h", "agency_list_control_attachments", { control_id: "c1" });
  });

  it("shows each page's rows", async () => {
    expect(await threatsPage.rows("h", scope)).toEqual([
      { id: "t1", code: "T-1", title: "No buyer", used_in: "Used in 2 bowties", controls: "" },
      { id: "t2", code: "T-2", title: "Late truck", used_in: "Used in 0 bowties", controls: "No controls" },
    ]);
    expect((await hazardsPage.rows("h", scope))[0]).toMatchObject({ code: "H-1", used_in: "Used in 2 bowties" });
    expect((await consequencesPage.rows("h", scope))[0]).toMatchObject({ code: "Q-1", used_in: "Used in 1 bowtie" });
  });

  it("writes parts with the exact tool and argument names", async () => {
    await createHazard("h", { title: "Flood", description: "Water" }, scope);
    await updateHazard("h", "h1", { title: "Flooding" }, scope);
    await deleteHazard("h", "h1");
    await createThreat("h", { title: "No buyer" }, scope);
    await deleteThreat("h", "t1");
    await createConsequence("h", { title: "Crops rot", hazardCode: "H-1" }, scope);
    await updateConsequence("h", "q1", { title: "Rot", description: "d", hazardCode: "H-2" }, scope);
    const calls = vi.mocked(callTool).mock.calls;
    expect(calls).toContainEqual(["h", "agency_create_hazard", { draft_id: "d1", title: "Flood", description: "Water" }]);
    expect(calls).toContainEqual(["h", "agency_update_hazard", { draft_id: "d1", title: "Flooding", hazard_id: "h1" }]);
    expect(calls).toContainEqual(["h", "agency_delete_hazard", { hazard_id: "h1" }]);
    expect(calls).toContainEqual(["h", "agency_create_threat", { draft_id: "d1", title: "No buyer" }]);
    expect(calls).toContainEqual(["h", "agency_delete_threat", { threat_id: "t1" }]);
    expect(calls).toContainEqual(["h", "agency_create_consequence", { draft_id: "d1", title: "Crops rot", hazard_code: "H-1" }]);
    expect(calls).toContainEqual(["h", "agency_update_consequence", { draft_id: "d1", title: "Rot", description: "d", hazard_code: "H-2", consequence_id: "q1" }]);
  });

  it("links and unlinks by code and by link id", async () => {
    await linkThreat("h", "RK-1", "T-1", scope);
    await unlinkThreat("h", "rt1");
    await linkConsequence("h", "RK-1", "Q-1", scope);
    await unlinkConsequence("h", "rc1");
    const calls = vi.mocked(callTool).mock.calls;
    expect(calls).toContainEqual(["h", "agency_create_risk_threat", { draft_id: "d1", risk_code: "RK-1", threat_code: "T-1" }]);
    expect(calls).toContainEqual(["h", "agency_delete_risk_threat", { risk_threat_id: "rt1" }]);
    expect(calls).toContainEqual(["h", "agency_create_risk_consequence", { draft_id: "d1", risk_code: "RK-1", consequence_code: "Q-1" }]);
    expect(calls).toContainEqual(["h", "agency_delete_risk_consequence", { risk_consequence_id: "rc1" }]);
  });
});
