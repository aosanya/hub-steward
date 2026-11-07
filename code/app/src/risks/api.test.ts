import { forgetRuntimeConfig, setRuntimeConfig } from "../wakala/config";
import { forgetSubject } from "../wakala/me";
import { resetMcp } from "../wakala/mcp";
import { mcpRisksClient, riskTools } from "./api";

type Sent = { tool: string; args: Record<string, any> };

const stub = (replies: Record<string, unknown>) => {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/me")) return { ok: true, status: 200, json: async () => ({ subject: "officer-ilona" }) };
      const body = JSON.parse(String(init?.body || "{}"));
      let result: unknown = {};
      if (body.method === "tools/call") {
        sent.push({ tool: body.params.name, args: body.params.arguments });
        result = { structuredContent: replies[body.params.name] ?? { items: [] } };
      }
      const text = JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result });
      return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
    }),
  );
  return sent;
};

beforeEach(() => {
  setRuntimeConfig({ wakala: "https://api.example", mcp: "https://api.example/mcp" });
  resetMcp();
  forgetSubject();
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetRuntimeConfig();
  resetMcp();
  forgetSubject();
});

const mine = { id: "r1", title: "Boiler room fire", top_event: "Fire in the boiler room", status: "open", owner: "officer-ilona" };
const theirs = { id: "r2", title: "Archive flood", top_event: "Water in the archive", status: "open", owner: "officer-bence" };

describe("the officer's risks", () => {
  it("asks for the officer's own risks and drops any row owned by someone else", async () => {
    const sent = stub({ [riskTools.risks]: { items: [mine, theirs] } });
    const found = await mcpRisksClient.myRisks();
    expect(found.map((risk) => risk.id)).toEqual(["r1"]);
    expect(sent.find((call) => call.tool === riskTools.risks)?.args.owner).toBe("officer-ilona");
  });

  it("asks for the officer's own actions", async () => {
    const sent = stub({
      [riskTools.actions]: {
        items: [
          { id: "a1", risk_id: "r1", title: "Service the sprinklers", status: "in_progress", due_at: "2026-12-01T00:00:00Z", owner: "officer-ilona" },
          { id: "a2", risk_id: "r2", title: "Move the files", status: "open", owner: "officer-bence" },
        ],
      },
    });
    const found = await mcpRisksClient.myActions();
    expect(found).toEqual([{ id: "a1", riskId: "r1", title: "Service the sprinklers", status: "in_progress", dueAt: "2026-12-01T00:00:00Z", owner: "officer-ilona" }]);
    expect(sent.find((call) => call.tool === riskTools.actions)?.args.owner).toBe("officer-ilona");
  });
});

describe("one risk", () => {
  const bowtie = {
    risk: mine,
    inherent: { score: 15, band: "high" },
    residual: { score: 6, band: "medium" },
    actions: [{ id: "a1", risk_id: "r1", title: "Service the sprinklers", status: "open", owner: "officer-ilona" }],
  };
  const measure = (side: string, barrier: string, standing: string) => ({
    barrier: { id: barrier },
    pathway: { title: `${side} route`, side },
    control: { name: `${barrier} control` },
    standing,
    evidence_count: 2,
    latest_evidence: { outcome: "pass" },
  });

  it("joins the bow-tie with each safeguard's standing from both sides", async () => {
    const sent = stub({
      [riskTools.bowtie]: bowtie,
      [riskTools.preventive]: { items: [measure("threat", "b1", "proven")] },
      [riskTools.mitigating]: { items: [measure("consequence", "b2", "failing")] },
    });
    const detail = await mcpRisksClient.risk("r1");
    expect(detail.ratings).toEqual([
      { kind: "inherent", score: 15, band: "high" },
      { kind: "residual", score: 6, band: "medium" },
    ]);
    expect(detail.safeguards.map((s) => [s.barrierId, s.side, s.standing, s.evidenceCount, s.latestOutcome])).toEqual([
      ["b1", "threat", "proven", 2, "pass"],
      ["b2", "consequence", "failing", 2, "pass"],
    ]);
    expect(detail.actions.map((a) => a.id)).toEqual(["a1"]);
    expect(sent.find((call) => call.tool === riskTools.bowtie)?.args.riskID).toBe("r1");
    expect(sent.find((call) => call.tool === riskTools.preventive)?.args.risk_id).toBe("r1");
  });

  it("refuses a risk that belongs to someone else", async () => {
    stub({ [riskTools.bowtie]: { risk: theirs } });
    await expect(mcpRisksClient.risk("r2")).rejects.toThrow();
  });
});

describe("evidence", () => {
  it("records the evidence against the barrier with the attached file's name as its reference", async () => {
    const sent = stub({});
    await mcpRisksClient.recordEvidence({ barrierId: "b1", kind: "test", outcome: "pass", summary: "Ran the alarm", reference: "alarm.jpg" });
    expect(sent.find((call) => call.tool === riskTools.evidence)?.args).toMatchObject({
      barrier_id: "b1",
      kind: "test",
      outcome: "pass",
      summary: "Ran the alarm",
      reference: "alarm.jpg",
    });
  });
});
