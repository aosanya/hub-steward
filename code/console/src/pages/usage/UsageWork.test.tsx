import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { UsageRow } from "../../data/usageBreakdown";
import { UsageWork } from "./UsageWork";
import { renderUsage } from "./usageTesting";

const row = (over: Partial<UsageRow> = {}): UsageRow => ({
  day: "2026-10-01",
  model: "Muse Spark 1.3",
  roleId: "r1",
  role: "Farmers' agent",
  kind: "chat",
  person: "p1",
  tokensIn: 700,
  tokensOut: 300,
  requests: 2,
  ...over,
});

const usage = { from: "2026-10-01", to: "2026-10-03", rows: [] };

describe("the Usage Work view", () => {
  it("shows the work by kind and the models against the kinds", () => {
    const rows = [row(), row({ kind: "test_run", model: "Muse Spark 1.2", tokensIn: 400, tokensOut: 100 })];
    renderUsage(<UsageWork usage={usage} rows={rows} />, "usage-work");
    expect(screen.getByRole("heading", { name: "By kind of work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Model by kind of work" })).toBeInTheDocument();
    expect(screen.getAllByText("Chat").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test run").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Muse Spark 1.2").length).toBeGreaterThan(0);
  });

  it("puts the total in the middle of the ring", () => {
    renderUsage(<UsageWork usage={usage} rows={[row(), row({ tokensIn: 5000, tokensOut: 1000 })]} />, "usage-work");
    expect(screen.getAllByText("7k").length).toBeGreaterThan(0);
  });

  it("names the range in the chart titles", () => {
    renderUsage(<UsageWork usage={usage} rows={[row()]} />, "usage-work");
    expect(document.body.innerHTML).toContain("Oct 1 – Oct 3");
  });

  it("shows no kind that did no work", () => {
    renderUsage(<UsageWork usage={usage} rows={[row()]} />, "usage-work");
    expect(screen.queryByText("Workflow run")).toBeNull();
    expect(screen.queryByText("Connection test")).toBeNull();
  });
});
