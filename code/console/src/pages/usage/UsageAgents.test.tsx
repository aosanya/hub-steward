import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UsageRow } from "../../data/usageBreakdown";
import { UsageAgents } from "./UsageAgents";
import { renderUsage } from "./usageTesting";

const row = (over: Partial<UsageRow> = {}): UsageRow => ({
  day: "2026-10-01",
  model: "Muse Spark 1.3",
  roleId: "r1",
  role: "Farmers' agent",
  kind: "chat",
  person: "p1",
  tokensIn: 1200,
  tokensOut: 300,
  requests: 3,
  ...over,
});

const rows = [
  row(),
  row({ day: "2026-10-02", kind: "test_run", person: "p2", tokensIn: 2400, tokensOut: 600, requests: 5 }),
  row({ roleId: "r2", role: "Suppliers' agent", model: "Muse Spark 1.2", person: "", kind: "background_job", tokensIn: 100, tokensOut: 50, requests: 1 }),
];

const names = new Map([
  ["p1", "Asha Otieno"],
  ["p2", "Hub manager"],
]);

const table = () => screen.getByRole("table");

describe("the Usage Agents view", () => {
  it("ranks the agents and lists one breakdown line for each agent, kind and model", () => {
    renderUsage(<UsageAgents rows={rows} names={names} group="agent" roleName="" onRole={() => {}} />, "usage-agents");
    expect(screen.getByRole("heading", { name: "By agent" })).toBeInTheDocument();
    const head = within(table()).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(head).toEqual(["Agent", "Kind of work", "Model", "Input", "Output", "Requests"]);
    const body = within(table()).getAllByRole("row").slice(1);
    expect(body).toHaveLength(3);
    expect(within(body[0]).getByText("Farmers' agent")).toBeInTheDocument();
    expect(within(body[0]).getByText("Test run")).toBeInTheDocument();
    expect(within(body[0]).getByText("2,400")).toBeInTheDocument();
    expect(within(body[2]).getByText("Background job")).toBeInTheDocument();
  });

  it("opens an agent from its bar", async () => {
    const onRole = vi.fn();
    renderUsage(<UsageAgents rows={rows} names={names} group="agent" roleName="" onRole={onRole} />, "usage-agents");
    await userEvent.click(screen.getByRole("button", { name: /Suppliers' agent/ }));
    expect(onRole).toHaveBeenCalledWith("r2");
  });

  it("ranks people by name when grouped by person, with the agent itself and someone gone named", () => {
    renderUsage(
      <UsageAgents rows={[...rows, row({ person: "p9", tokensIn: 10, tokensOut: 5 })]} names={names} group="person" roleName="" onRole={() => {}} />,
      "usage-agents",
    );
    expect(screen.getByRole("heading", { name: "By person" })).toBeInTheDocument();
    expect(within(table()).getAllByRole("columnheader")[0]).toHaveTextContent("Person");
    expect(screen.getAllByText("Asha Otieno").length).toBeGreaterThan(0);
    expect(screen.getAllByText("The agent itself").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Someone no longer in the hub").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Asha Otieno/ })).toBeNull();
  });

  it("names the agent in the title when one agent is open and ranks its people", () => {
    renderUsage(<UsageAgents rows={rows.slice(0, 2)} names={names} group="agent" roleName="Farmers' agent" onRole={() => {}} />, "usage-agents");
    expect(screen.getByRole("heading", { name: "Who used Farmers' agent" })).toBeInTheDocument();
    expect(screen.getAllByText("Hub manager").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Hub manager/ })).toBeNull();
  });

  it("says there are no calls when the span holds none", () => {
    renderUsage(<UsageAgents rows={[]} names={names} group="agent" roleName="" onRole={() => {}} />, "usage-agents");
    expect(screen.getByText(/^No calls yet in this span/)).toBeInTheDocument();
  });
});
