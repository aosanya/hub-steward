import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageOverview } from "./UsageOverview";
import { renderUsage } from "./usageTesting";

const usage = { from: "2026-10-01", to: "2026-10-03", rows: [] };

const rows = [
  { day: "2026-10-01", model: "Muse Spark 1.3", roleId: "r1", role: "Farmers' agent", kind: "chat" as const, person: "p1", tokensIn: 70, tokensOut: 30, requests: 2 },
  { day: "2026-10-02", model: "Muse Spark 1.2", roleId: "r2", role: "Suppliers' agent", kind: "test_run" as const, person: "p2", tokensIn: 160, tokensOut: 40, requests: 4 },
];

describe("the Usage Overview figures", () => {
  it("share one row: the four tiles sit in a grid whose minimum column is 9rem", () => {
    renderUsage(<UsageOverview usage={usage} rows={rows} />, "usage-overview");
    const grid = screen.getByText("Tokens", { selector: ".stat-label" }).closest(".grid") as HTMLElement;
    expect(grid.querySelectorAll(".stat")).toHaveLength(4);
    expect(grid.style.getPropertyValue("--grid-min")).toBe("9rem");
  });
});
