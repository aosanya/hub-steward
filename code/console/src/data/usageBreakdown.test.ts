import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import {
  breakdownOf,
  daysOf,
  figuresOf,
  forRole,
  heatOf,
  kindSlices,
  loadUsage,
  perDaySeries,
  rankedOf,
  rolesOf,
  type Names,
} from "./usageBreakdown";

vi.mock("../wakala/mcp");

const words = { byItself: "The agent itself", unknownPerson: "Someone no longer in the hub" };

const wire = (day: string, over: Record<string, unknown> = {}) => ({
  day,
  model: "Muse Spark 1.3",
  role_id: "r1",
  role: "Farmers' agent",
  kind: "chat",
  person: "p1",
  tokens_in: 70,
  tokens_out: 30,
  requests: 2,
  ...over,
});

const answer = {
  window: "month",
  from: "2026-10-01",
  to: "2026-10-03",
  rows: [
    wire("2026-10-01"),
    wire("2026-10-02", { kind: "test_run", person: "p2", tokens_in: 160, tokens_out: 40, requests: 4 }),
    wire("2026-10-02", { role_id: "r2", role: "Suppliers' agent", model: "Muse Spark 1.2", person: "", kind: "background_job", tokens_in: 30, tokens_out: 20, requests: 1 }),
    wire("2026-10-03", { kind: "mystery", tokens_in: 10, tokens_out: 0, requests: 1 }),
  ],
};

const names: Names = new Map([
  ["p1", "Asha Otieno"],
  ["p2", "Hub manager"],
]);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockResolvedValue(answer as never);
});

const read = async () => loadUsage("h1", "month", "agent");

describe("reading the usage breakdown", () => {
  it("asks ai_usage_breakdown for the span and the grouping", async () => {
    await loadUsage("h1", "last_month", "person");
    expect(callTool).toHaveBeenCalledWith("h1", "ai_usage_breakdown", { window: "last_month", group_by: "person" });
  });

  it("reads each row, and a kind it does not know becomes other", async () => {
    const usage = await read();
    expect(usage.from).toBe("2026-10-01");
    expect(usage.rows).toHaveLength(4);
    expect(usage.rows[0]).toEqual({ day: "2026-10-01", model: "Muse Spark 1.3", roleId: "r1", role: "Farmers' agent", kind: "chat", person: "p1", tokensIn: 70, tokensOut: 30, requests: 2 });
    expect(usage.rows[3].kind).toBe("other");
  });

  it("reads no rows as an empty list", async () => {
    vi.mocked(callTool).mockResolvedValue({ window: "today", rows: null } as never);
    expect((await read()).rows).toEqual([]);
  });
});

describe("the figures drawn from the rows", () => {
  it("add up tokens and requests, the input share and the top model", async () => {
    const { rows } = await read();
    expect(figuresOf(rows)).toEqual({ tokens: 360, requests: 8, inputShare: 75, topModel: "Muse Spark 1.3", topShare: 86 });
  });

  it("have no top model when there are no rows", () => {
    expect(figuresOf([])).toEqual({ tokens: 0, requests: 0, inputShare: 0, topModel: "", topShare: 0 });
  });

  it("fill every day from the first to the last, even a day with no calls", () => {
    expect(daysOf({ from: "2026-10-01", to: "2026-10-05", rows: [] })).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
  });

  it("stack each model's tokens per day, heaviest model first", async () => {
    const usage = await read();
    const series = perDaySeries(usage.rows, daysOf(usage));
    expect(series.map((one) => one.name)).toEqual(["Muse Spark 1.3", "Muse Spark 1.2"]);
    expect(series[0].values).toEqual([100, 200, 10]);
    expect(series[1].values).toEqual([0, 50, 0]);
  });

  it("split by kind of work in the design's order, leaving out kinds with no tokens", async () => {
    const { rows } = await read();
    expect(kindSlices(rows)).toEqual([
      { kind: "chat", value: 100 },
      { kind: "test_run", value: 200 },
      { kind: "background_job", value: 50 },
      { kind: "other", value: 10 },
    ]);
  });

  it("lay models against the kinds that appear", async () => {
    const { rows } = await read();
    const heat = heatOf(rows);
    expect(heat.models).toEqual(["Muse Spark 1.3", "Muse Spark 1.2"]);
    expect(heat.kinds).toEqual(["chat", "test_run", "background_job", "other"]);
    expect(heat.matrix).toEqual([
      [100, 200, 0, 10],
      [0, 0, 50, 0],
    ]);
  });
});

describe("who spent the tokens", () => {
  it("ranks agents by their tokens with input and output", async () => {
    const { rows } = await read();
    const ranked = rankedOf(rows, "role", names, words);
    expect(ranked.map((one) => [one.name, one.tokensIn, one.tokensOut])).toEqual([
      ["Farmers' agent", 240, 70],
      ["Suppliers' agent", 30, 20],
    ]);
  });

  it("ranks people by name, an empty person as the agent itself and an unknown id as someone who left", async () => {
    const { rows } = await read();
    const extra = [...rows, ...rows.slice(0, 1).map((row) => ({ ...row, person: "gone", tokensIn: 1, tokensOut: 1 }))];
    expect(rankedOf(extra, "person", names, words).map((one) => one.name)).toEqual(["Hub manager", "Asha Otieno", "The agent itself", "Someone no longer in the hub"]);
  });

  it("lists the breakdown by agent, kind and model, heaviest first", async () => {
    const { rows } = await read();
    const lines = breakdownOf(rows, "role", names, words);
    expect(lines[0]).toMatchObject({ who: "Farmers' agent", kind: "test_run", model: "Muse Spark 1.3", tokensIn: 160, tokensOut: 40, requests: 4 });
    expect(lines).toHaveLength(4);
  });

  it("narrows to one role and names the roles it saw", async () => {
    const { rows } = await read();
    expect(rolesOf(rows).get("r2")).toBe("Suppliers' agent");
    expect(forRole(rows, "r2")).toHaveLength(1);
    expect(forRole(rows, "")).toHaveLength(4);
  });
});
