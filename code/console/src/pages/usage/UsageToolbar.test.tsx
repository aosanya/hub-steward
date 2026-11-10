import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UsageToolbar } from "./UsageToolbar";
import { renderUsage } from "./usageTesting";
import type { UsageQuery } from "./useUsageQuery";

const queryOf = (over: Partial<UsageQuery> = {}): UsageQuery => ({ span: "month", group: "agent", role: "", change: vi.fn(), ...over });

describe("the Usage toolbar", () => {
  it("offers the four spans and marks the chosen one", () => {
    renderUsage(<UsageToolbar query={queryOf({ span: "7d" })} roleName="" showGroup={false} />, "usage");
    const show = screen.getByRole("group", { name: "Show" });
    expect(within(show).getAllByRole("button").map((button) => button.textContent)).toEqual(["Today", "7 days", "This month", "Last month"]);
    expect(within(show).getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
    expect(within(show).getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the span that was tapped", async () => {
    const query = queryOf();
    renderUsage(<UsageToolbar query={query} roleName="" showGroup={false} />, "usage");
    await userEvent.click(screen.getByRole("button", { name: "Last month" }));
    expect(query.change).toHaveBeenCalledWith({ span: "last_month" });
  });

  it("shows the Group by switch only when asked and reports a group", async () => {
    const query = queryOf({ group: "agent" });
    renderUsage(<UsageToolbar query={query} roleName="" showGroup />, "usage");
    const group = screen.getByRole("group", { name: "Group by" });
    expect(within(group).getByRole("button", { name: "Agent" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(group).getByRole("button", { name: "Person" }));
    expect(query.change).toHaveBeenCalledWith({ group: "person" });
  });

  it("hides the Group by switch when not asked", () => {
    renderUsage(<UsageToolbar query={queryOf()} roleName="" showGroup={false} />, "usage");
    expect(screen.queryByRole("group", { name: "Group by" })).toBeNull();
  });

  it("shows the chosen role as a chip that clears the role", async () => {
    const query = queryOf({ role: "r1" });
    renderUsage(<UsageToolbar query={query} roleName="Farmers' agent" showGroup />, "usage");
    expect(screen.getByText("Role: Farmers' agent")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /remove|clear|×|x/i }));
    expect(query.change).toHaveBeenCalledWith({ role: "" });
  });

  it("shows no role chip without a role name", () => {
    renderUsage(<UsageToolbar query={queryOf()} roleName="" showGroup />, "usage");
    expect(screen.queryByText(/^Role:/)).toBeNull();
  });
});
