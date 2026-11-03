import { render, screen, within } from "@testing-library/react";
import words from "../../../public/i18n.json";
import { loadNames } from "../../data/usageBreakdown";
import { I18nProvider } from "../../i18n";
import { callTool } from "../../wakala/mcp";
import { UsageAnswerView } from "./UsageAnswerView";

vi.mock("../../wakala/mcp");

vi.mock("../../data/usageBreakdown", async (original) => ({ ...(await original<object>()), loadNames: vi.fn() }));

const row = (day: string, role: string, kind: string, person: string, tokensIn: number, tokensOut: number, requests: number) => ({
  day,
  model: "Muse Spark 1.3",
  role_id: role === "Farmers' agent" ? "r1" : "r2",
  role,
  kind,
  person,
  tokens_in: tokensIn,
  tokens_out: tokensOut,
  requests,
});

const month = {
  from: "2026-10-01",
  to: "2026-10-28",
  rows: [
    row("2026-10-10", "Farmers' agent", "chat", "", 100000, 50000, 10),
    row("2026-10-14", "Farmers' agent", "test_run", "p1", 150000, 20000, 11),
    row("2026-10-14", "Suppliers' agent", "test_run", "p1", 50000, 10000, 4),
    row("2026-10-15", "Farmers' agent", "test_run", "p1", 90000, 10000, 6),
    row("2026-10-16", "Suppliers' agent", "test_run", "", 20000, 5000, 3),
  ],
};

const open = (params: Record<string, unknown>) =>
  render(
    <I18nProvider initial={words}>
      <UsageAnswerView hubId="h1" title="" params={params} onDone={() => {}} />
    </I18nProvider>,
  );

const statOf = (label: string) =>
  [...document.querySelectorAll<HTMLElement>(".stat")].find((stat) => within(stat).queryByText(label, { selector: ".stat-label" })) as HTMLElement;

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockResolvedValue(month as never);
  vi.mocked(loadNames).mockResolvedValue(new Map([["p1", "Hub manager"]]));
});

describe("the usage answer the chat puts in the content area", () => {
  it("reads the breakdown for the span the manager asked about", async () => {
    open({ kind: "test_run", window: "last_month" });
    await screen.findByText("Test run", { selector: ".stat-label" });
    expect(callTool).toHaveBeenCalledWith("h1", "ai_usage_breakdown", { window: "last_month", group_by: "person" });
  });

  it("shows the kind's tokens, its share of the span, its runs and its busiest day", async () => {
    open({ kind: "test_run" });
    await screen.findByText("Test run", { selector: ".stat-label" });
    const tokens = statOf("Test run");
    expect(within(tokens).getByText("355k")).toBeInTheDocument();
    expect(within(tokens).getByText("70% of the month's tokens")).toBeInTheDocument();
    const runs = statOf("Runs");
    expect(within(runs).getByText("24")).toBeInTheDocument();
    const busiest = statOf("Busiest day");
    expect(within(busiest).getByText(/14 Oct|Oct 14/)).toBeInTheDocument();
    expect(within(busiest).getByText("230k tokens")).toBeInTheDocument();
  });

  it("ranks the agents that spent the kind and leaves the other kinds out", async () => {
    open({ kind: "test_run" });
    const card = (await screen.findByRole("heading", { level: 2, name: "Test run by agent" })).closest("section") as HTMLElement;
    const names = within(card).getAllByText(/^(Farmers|Suppliers)' agent$/).map((node) => node.textContent);
    expect(names).toEqual(["Farmers' agent", "Suppliers' agent"]);
    expect(within(card).getByText(/270k/)).toBeInTheDocument();
  });

  it("lists the busiest days with who ran them, the agent itself when no one did", async () => {
    open({ kind: "test_run" });
    await screen.findByRole("heading", { level: 2, name: "The 3 busiest days" });
    const rows = screen.getAllByRole("row").slice(1).map((line) => within(line).getAllByRole("cell").map((cell) => cell.textContent));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual([expect.stringMatching(/14 Oct|Oct 14/), "230,000", "15", "Hub manager"]);
    expect(rows[1]).toEqual([expect.stringMatching(/15 Oct|Oct 15/), "100,000", "6", "Hub manager"]);
    expect(rows[2]).toEqual([expect.stringMatching(/16 Oct|Oct 16/), "25,000", "3", "The agent itself"]);
  });

  it("answers for one agent when the question names its role", async () => {
    open({ kind: "test_run", role_id: "r2" });
    await screen.findByText("Test run", { selector: ".stat-label" });
    const tokens = statOf("Test run");
    expect(within(tokens).getByText("85k")).toBeInTheDocument();
  });

  it("says there are no calls when the span holds none", async () => {
    vi.mocked(callTool).mockResolvedValue({ from: "2026-10-01", to: "2026-10-28", rows: [] } as never);
    open({ kind: "test_run" });
    expect(await screen.findByText(words.en["usage.noCalls"])).toBeInTheDocument();
  });

  it("says it could not load when the tool fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("ai_usage_breakdown: refused"));
    open({});
    expect(await screen.findByText(words.en.loadFailed)).toBeInTheDocument();
  });
});
