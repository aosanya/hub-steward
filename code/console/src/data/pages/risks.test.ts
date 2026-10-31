import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { listRisks, pickRisk, riskLanding, risksPage } from "./risks";

vi.mock("../../wakala/mcp");

const risks = [
  { id: "r1", code: "RK-1", title: "Unsold harvest", top_event: "Crops rot" },
  { id: "r2", code: "RK-2", title: "Late inputs", top_event: "Planting is missed", hazard: "Weather", owner: "Farmer" },
];

const replies: Record<string, unknown> = {
  agency_list_risks: { items: risks },
  agency_list_risk_pathways: { items: [{ id: "p1", code: "RP-1", title: "No buyer", scenario: "s" }] },
  agency_list_threats: { items: [] },
  agency_list_consequences: { items: [] },
  agency_list_risk_threats: { items: [] },
  agency_list_risk_consequences: { items: [] },
  agency_list_hazards: { items: [{ id: "h9", code: "H-1", title: "Bad weather" }] },
};

const library: Record<string, unknown> = {
  ...replies,
  agency_list_threats: { items: [{ id: "t1", code: "T-1", title: "No buyer", description: "d", control_codes: ["C-1", "C-2"] }, { id: "t2", code: "T-2", title: "Theft" }] },
  agency_list_consequences: { items: [{ id: "q1", code: "Q-1", title: "Crops rot" }] },
  agency_list_risk_threats: { items: [{ id: "l1", risk_code: "RK-2", threat_code: "T-1" }, { id: "l2", risk_code: "RK-2", threat_code: "T-9" }] },
  agency_list_risk_consequences: { items: [{ id: "l3", risk_code: "RK-2", consequence_code: "Q-1" }] },
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => (tool === "agency_list_drafts" ? { items: [] } : replies[tool]) as never);
});

describe("the risks page", () => {
  it("names the read tools and has no write", () => {
    expect(risksPage.spec.id).toBe("risks");
    expect(risksPage.spec.tools).toContain("agency_list_risk_threats");
    expect(risksPage.actions).toBeUndefined();
  });

  it("lists the risks as rows", async () => {
    expect(await risksPage.rows("h1", { draft_id: "d1" })).toEqual([
      { id: "r1", code: "RK-1", title: "Unsold harvest", top_event: "Crops rot" },
      { id: "r2", code: "RK-2", title: "Late inputs", top_event: "Planting is missed" },
    ]);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_list_risks", { draft_id: "d1" });
  });

  it("lands on the asked-for risk, else the first", async () => {
    const listed = await listRisks("h1", { draft_id: "d1" });
    expect(pickRisk(listed, "r2").id).toBe("r2");
    expect(pickRisk(listed, "").id).toBe("r1");
    expect(pickRisk([], "")).toBeUndefined();
  });

  it("reads a risk's linked library parts with their controls", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => (tool === "agency_list_drafts" ? { items: [] } : library[tool]) as never);
    const risk = { ...(await listRisks("h1", { draft_id: "d1" }))[1], hazardCode: "H-1" };
    const landing = await riskLanding("h1", risk, { draft_id: "d1" });
    expect(landing.hazardTitle).toBe("Bad weather");
    expect(landing.threats).toEqual([{ id: "t1", linkId: "l1", code: "T-1", title: "No buyer", description: "d", controls: 2, legacy: false }]);
    expect(landing.consequences.map((part) => part.linkId)).toEqual(["l3"]);
    expect(landing.library.threats.map((part) => part.code)).toEqual(["T-1", "T-2"]);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_list_risk_threats", { draft_id: "d1", risk_code: "RK-2" });
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_list_hazards", { draft_id: "d1", code: "H-1" });
    expect(vi.mocked(callTool)).not.toHaveBeenCalledWith("h1", "agency_list_risk_pathways", expect.anything());
  });

  it("falls back to pathways when the draft has no library parts", async () => {
    const landing = await riskLanding("h1", (await listRisks("h1", { draft_id: "d1" }))[1], { draft_id: "d1" });
    expect(landing.risk.owner).toBe("Farmer");
    expect(landing.hazardTitle).toBe("Weather");
    expect(landing.threats).toEqual([{ id: "p1", linkId: "p1", code: "RP-1", title: "No buyer", description: "s", controls: 0, legacy: true }]);
    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "agency_list_risk_pathways", { draft_id: "d1", risk_id: "r2", side: "consequence" });
  });
});
