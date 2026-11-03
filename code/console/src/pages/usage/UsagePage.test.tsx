import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usersPage } from "../../data/pages/users";
import { callTool } from "../../wakala/mcp";
import { UsageAgentsView, UsageOverviewView, UsageRedirect, UsageWorkView } from "./usageViews";
import { month, renderUsage, wire } from "./usageTesting";

vi.mock("../../wakala/mcp");

vi.mock("../../data/pages/users", () => ({ usersPage: { rows: vi.fn() } }));

const answerWith = (reply: unknown) => vi.mocked(callTool).mockImplementation(async () => reply as never);

const breakdownCalls = () => vi.mocked(callTool).mock.calls.filter((call) => call[1] === "ai_usage_breakdown").map((call) => call[2]);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(usersPage.rows).mockReset();
  vi.mocked(usersPage.rows).mockResolvedValue([
    { id: "p1", user: "Asha Otieno" },
    { id: "p2", user: "Hub manager" },
  ]);
  answerWith(month);
});

describe("the Usage Overview", () => {
  it("asks for this month grouped by agent and draws the four figures from the answer", async () => {
    renderUsage(<UsageOverviewView />, "usage-overview");
    expect(await screen.findByText("Input vs output")).toBeInTheDocument();
    expect(breakdownCalls()).toEqual([{ window: "month", group_by: "agent" }]);
    const tokens = screen.getByText("Tokens", { selector: ".stat-label" }).closest(".stat") as HTMLElement;
    expect(within(tokens).getByText("350")).toBeInTheDocument();
    const split = screen.getByText("Input vs output").closest(".stat") as HTMLElement;
    expect(within(split).getByText("74 / 26")).toBeInTheDocument();
    const top = screen.getByText("Top model").closest(".stat") as HTMLElement;
    expect(within(top).getByText("86%")).toBeInTheDocument();
    expect(within(top).getByText("Muse Spark 1.3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tokens per day, by model" })).toBeInTheDocument();
  });

  it("is titled Usage and offers Today, 7 days, This month and Last month, with This month chosen", async () => {
    renderUsage(<UsageOverviewView />, "usage-overview");
    await screen.findByText("Input vs output");
    expect(screen.getByRole("heading", { level: 1, name: "Usage" })).toBeInTheDocument();
    const show = screen.getByRole("group", { name: "Show" });
    expect(within(show).getAllByRole("button").map((button) => button.textContent)).toEqual(["Today", "7 days", "This month", "Last month"]);
    expect(within(show).getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "Group by" })).not.toBeInTheDocument();
  });

  it("asks again for another span and keeps it in the address", async () => {
    const user = userEvent.setup();
    renderUsage(<UsageOverviewView />, "usage-overview");
    await screen.findByText("Input vs output");
    await user.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(breakdownCalls().at(-1)).toEqual({ window: "7d", group_by: "agent" }));
    expect(screen.getByTestId("search")).toHaveTextContent("?span=7d");
    expect(await screen.findByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens on the span the address names", async () => {
    renderUsage(<UsageOverviewView />, "usage-overview", { search: "?span=last_month" });
    await screen.findByText("Input vs output");
    expect(breakdownCalls()).toEqual([{ window: "last_month", group_by: "agent" }]);
  });

  it("says there are no calls yet in a card with the Test a model button inside, and keeps the span choice", async () => {
    answerWith({ window: "month", from: "2026-10-01", to: "2026-10-28", rows: [] });
    renderUsage(<UsageOverviewView />, "usage-overview");
    const message = await screen.findByText(/No calls yet in this span/);
    const card = message.closest(".empty") as HTMLElement;
    expect(within(card).getByRole("link", { name: "Test a model" })).toHaveAttribute("href", "/h/h1/models");
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument();
  });

  it("says the page could not be loaded when the tool fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("unknown tool"));
    renderUsage(<UsageOverviewView />, "usage-overview");
    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("empty", "error");
  });
});

describe("Usage for a staff seat", () => {
  it.each([
    ["usage-overview", UsageOverviewView],
    ["usage-work", UsageWorkView],
    ["usage-agents", UsageAgentsView],
  ])("shows one plain line on %s and reads nothing", async (page, View) => {
    renderUsage(<View />, page, { role: "agent" });
    expect(await screen.findByText("Only the hub manager sees Usage.")).toBeInTheDocument();
    expect(callTool).not.toHaveBeenCalled();
  });
});

describe("Usage Kind of work", () => {
  it("lists each kind of work with its tokens and lays the models against the kinds", async () => {
    renderUsage(<UsageWorkView />, "usage-work");
    expect(await screen.findByRole("heading", { level: 2, name: "By kind of work" })).toBeInTheDocument();
    expect(breakdownCalls()).toEqual([{ window: "month", group_by: "agent" }]);
    for (const kind of ["Chat", "Test run", "Background job"]) expect(screen.getAllByText(kind).length).toBeGreaterThan(0);
    expect(screen.queryByText("Agency review")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Model by kind of work" })).toBeInTheDocument();
    expect(screen.getAllByText("Muse Spark 1.2").length).toBeGreaterThan(0);
  });

  it("narrows to the agent the address names, with its chip that clears the filter", async () => {
    const user = userEvent.setup();
    renderUsage(<UsageWorkView />, "usage-work", { search: "?role=r2" });
    const chip = await screen.findByText("Role: Suppliers' agent");
    expect(screen.queryByText("Muse Spark 1.3")).not.toBeInTheDocument();
    await user.click(within(chip.closest(".filter") as HTMLElement).getByRole("button"));
    await waitFor(() => expect(screen.queryByText("Role: Suppliers' agent")).not.toBeInTheDocument());
    expect(screen.getByTestId("search")).toHaveTextContent("");
  });
});

describe("Usage Agents and people", () => {
  it("ranks the agents and lists the breakdown by agent, kind of work and model", async () => {
    renderUsage(<UsageAgentsView />, "usage-agents");
    expect(await screen.findByRole("heading", { level: 2, name: "By agent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Farmers' agent/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Suppliers' agent/ })).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Agent", "Kind of work", "Model", "Input", "Output", "Requests"]);
    expect(table.getAllByRole("row")).toHaveLength(4);
    expect(within(screen.getByRole("group", { name: "Group by" })).getByRole("button", { name: "Agent" })).toHaveAttribute("aria-pressed", "true");
  });

  it("charges the tokens to people under Person, with the agent itself for a job it started, and asks again", async () => {
    const user = userEvent.setup();
    renderUsage(<UsageAgentsView />, "usage-agents");
    await screen.findByRole("heading", { level: 2, name: "By agent" });
    await user.click(within(screen.getByRole("group", { name: "Group by" })).getByRole("button", { name: "Person" }));
    expect(await screen.findByRole("heading", { level: 2, name: "By person" })).toBeInTheDocument();
    expect(breakdownCalls().at(-1)).toEqual({ window: "month", group_by: "person" });
    for (const name of ["Asha Otieno", "Hub manager", "The agent itself"]) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "Person" })).toBeInTheDocument();
  });

  it("names a person who is no longer in the hub, never an id", async () => {
    answerWith({ ...month, rows: [wire("2026-10-01", { person: "gone-actor-id" })] });
    renderUsage(<UsageAgentsView />, "usage-agents", { search: "?group=person" });
    expect(await screen.findAllByText("Someone no longer in the hub")).not.toHaveLength(0);
    expect(screen.queryByText("gone-actor-id")).not.toBeInTheDocument();
  });

  it("filters to an agent when its bar is clicked, shows who used it, and keeps the filter when the span changes", async () => {
    const user = userEvent.setup();
    renderUsage(<UsageAgentsView />, "usage-agents");
    await user.click(await screen.findByRole("button", { name: /Farmers' agent/ }));
    expect(await screen.findByText("Role: Farmers' agent")).toBeInTheDocument();
    expect(screen.getByTestId("search")).toHaveTextContent("?role=r1");
    expect(screen.getByRole("heading", { level: 2, name: "Who used Farmers' agent" })).toBeInTheDocument();
    expect(screen.getAllByText("Asha Otieno").length).toBeGreaterThan(0);
    expect(screen.queryByText("Suppliers' agent")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("role=r1"));
    expect(screen.getByTestId("search")).toHaveTextContent("span=7d");
    expect(await screen.findByText("Role: Farmers' agent")).toBeInTheDocument();
  });
});

describe("the Usage entry in the menu", () => {
  it("opens Overview and keeps the filter and the span", async () => {
    renderUsage(<UsageRedirect />, "usage", { search: "?role=r1&span=7d" });
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("?role=r1&span=7d"));
  });
});
