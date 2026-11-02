import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { TestView } from "../views/TestView";
import { reportWhen } from "./reportWhen";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const startedAt = "2026-10-28T10:05:00Z";

const step = (n: number, more: Record<string, unknown> = {}) => ({
  step_id: "st" + n,
  step: "Step " + n,
  actor: "Actor " + n,
  played_by: "Player " + n,
  did: "Did " + n,
  recorded: "Recorded " + n,
  rules: [],
  tokens: 1000 * n,
  ...more,
});

const run = (result: string, steps: unknown[], more: Record<string, unknown> = {}) => ({
  id: "r1",
  scenario_id: "s1",
  draft_version: "ver-3",
  result,
  stop_reason: "",
  tokens: 16200,
  token_budget: 30000,
  started_at: startedAt,
  finished_at: "2026-10-28T10:06:00Z",
  steps,
  stored: [{ record: "group_order", holds: "The terms it started with", rows: 1 }],
  ...more,
});

const block = (n: number, more: Record<string, unknown> = {}) => ({
  step_id: "st" + n,
  title: "Title " + n,
  kind: "fill_form",
  action: "Action " + n,
  actor: "Actor " + n,
  then: "Then " + n,
  tool: "market_start_group_order",
  ...more,
});

const hub = (get: unknown, more: Record<string, unknown> = {}) => ({
  agency_get_test_run: get,
  agency_get_scenario: {
    id: "s1",
    name: "Shop says yes",
    workflow_id: "w1",
    result: "passed",
    last_run_id: "r1",
    blocks: [block(1), block(2, { kind: "chat", tool: "" })],
  },
  agency_get_agency: { agency: { name: "Siaya Farmers" } },
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_rules: {
    items: [
      { code: "RU-2", text: "A group order starts from a posted price." },
      { code: "RU-7", text: "The agents ask once." },
    ],
  },
  agency_list_test_runs: { items: [run("passed", [])] },
  ...more,
});

const show = (replies: Record<string, unknown>) => {
  answering(replies);
  return renderView("test", TestView, "?run=r1&report=1");
};

const details = async (): Promise<HTMLElement> =>
  (await screen.findByRole("heading", { name: "Report", level: 2 })).closest("section") as HTMLElement;

const section = (name: string): HTMLElement =>
  screen.getByRole("heading", { name }).parentElement?.parentElement as HTMLElement;

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the report of a run that ended", () => {
  it("holds the run's details", async () => {
    show(hub(run("passed", [step(1)])));

    const card = await details();
    expect(within(card).getByText("Siaya Farmers")).toBeInTheDocument();
    expect(within(card).getByText("Shop says yes")).toBeInTheDocument();
    expect(within(card).getByText(reportWhen(startedAt, "en"))).toBeInTheDocument();
    expect(within(card).getByText("ver-3")).toBeInTheDocument();
    expect(within(card).getByText("Passed")).toBeInTheDocument();
    expect(within(card).getByText("16,200 of 30,000")).toBeInTheDocument();
    expect(callsTo("agency_get_test_run")[0]).toEqual({ test_run_id: "r1" });
  });

  it("names the draft by its label when the run carries one", async () => {
    show(hub(run("passed", [step(1)], { draft_label: "Latest edit" })));

    const card = await details();
    expect(within(card).getByText("Latest edit")).toBeInTheDocument();
    expect(within(card).queryByText("ver-3")).not.toBeInTheDocument();
  });

  it("shows the tokens alone when the run was started under no limit", async () => {
    show(hub(run("passed", [step(1)], { token_budget: 0 })));

    const card = await details();
    expect(within(card).getByText("16,200")).toBeInTheDocument();
  });

  it("holds the script: each block with its actor, kind, action, what should follow and the endpoint", async () => {
    show(hub(run("passed", [step(1)])));

    await details();
    const rows = within(section("Steps")).getAllByRole("row");
    const first = within(rows[1]).getAllByRole("cell");
    expect(first.map((cell) => cell.textContent)).toEqual([
      "1",
      "Actor 1",
      "Fill a form",
      "Action 1",
      "Then 1",
      "market_start_group_order",
    ]);
    const second = within(rows[2]).getAllByRole("cell");
    expect(second[2]).toHaveTextContent("Chat");
  });

  it("holds what transpired step by step, with who played whom and the endpoint each used", async () => {
    show(
      hub(
        run("passed", [
          step(1, {
            rules: [{ code: "RU-2", held: true }],
            endpoint: "market_start_group_order",
            waited: true,
          }),
          step(2, { played_by: "" }),
        ]),
      ),
    );

    await details();
    const rows = within(section("What transpired")).getAllByRole("row");
    const first = within(rows[1]).getAllByRole("cell");
    expect(first[0]).toHaveTextContent("Actor 1");
    expect(first[0]).toHaveTextContent("Player 1 · Fill a form");
    expect(first[1]).toHaveTextContent("Did 1");
    expect(first[2]).toHaveTextContent("Recorded 1");
    expect(within(first[2]).getByText("RU-2 held")).toHaveClass("ok");
    expect(first[2]).toHaveTextContent("Endpoint: market_start_group_order");
    expect(first[3]).toHaveTextContent("Step 1");
    expect(within(first[3]).getByText("Wait acted out")).toBeInTheDocument();
    expect(first[4]).toHaveTextContent("1,000");
    const second = within(rows[2]).getAllByRole("cell");
    expect(second[0]).not.toHaveTextContent("·");
  });

  it("shows Expected and Found for the step that failed, with its rule failed", async () => {
    show(
      hub(
        run("failed", [
          step(1, {
            failed: true,
            expected: "One message to each shop",
            found: "A second ask",
            rules: [{ code: "RU-7", held: false }],
          }),
        ]),
      ),
    );

    await details();
    const row = within(section("What transpired")).getAllByRole("row")[1];
    expect(row).toHaveTextContent("Expected: One message to each shop");
    expect(row).toHaveTextContent("Found: A second ask");
    expect(row).not.toHaveTextContent("Recorded 1");
    expect(within(row).getByText("RU-7 failed")).toHaveClass("bad");
    expect(within(row).getByText("Failed")).toHaveClass("bad");
  });

  it("holds what was stored", async () => {
    show(hub(run("passed", [step(1)])));

    await details();
    const row = within(section("What was stored")).getAllByRole("row")[1];
    expect(row).toHaveTextContent("group_order");
    expect(row).toHaveTextContent("The terms it started with");
    expect(row).toHaveTextContent("1");
  });

  it("holds the rules the run checked, each with its text and whether it held", async () => {
    show(
      hub(
        run("failed", [
          step(1, { rules: [{ code: "RU-2", held: true }] }),
          step(2, { rules: [{ code: "RU-7", held: false }] }),
        ]),
      ),
    );

    await details();
    const rows = within(section("Rules held")).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("RU-2");
    expect(rows[1]).toHaveTextContent("A group order starts from a posted price.");
    expect(within(rows[1]).getByText("RU-2 held")).toHaveClass("ok");
    expect(rows[2]).toHaveTextContent("The agents ask once.");
    expect(within(rows[2]).getByText("RU-7 failed")).toHaveClass("bad");
  });

  it("prints the page when Print is pressed, and offers it in the title row", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    show(hub(run("passed", [step(1)])));

    await userEvent.click(await screen.findByRole("button", { name: "Print" }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it("goes back to the run", async () => {
    show(hub(run("passed", [step(1)])));

    expect(await screen.findByRole("link", { name: "Back" })).toHaveAttribute("href", "/h/h1/test?run=r1");
  });

  it("still reports the run when the scenario, the agency and the rules cannot be read", async () => {
    show(
      hub(run("passed", [step(1, { rules: [{ code: "RU-2", held: true }] })]), {
        agency_get_scenario: new McpError("agency_get_scenario: gone"),
        agency_get_agency: new McpError("agency_get_agency: gone"),
        agency_list_rules: new McpError("agency_list_rules: gone"),
      }),
    );

    const card = await details();
    expect(within(card).getByText("ver-3")).toBeInTheDocument();
    expect(within(section("Steps")).getByText("Nothing here yet.")).toBeInTheDocument();
    expect(within(section("What transpired")).getByText("Did 1")).toBeInTheDocument();
    expect(within(section("Rules held")).getByText("RU-2")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the run cannot be read", async () => {
    show(hub(new McpError("agency_get_test_run: gone")));

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Print" })).not.toBeInTheDocument();
  });
});

describe("the report of a run that is still going", () => {
  it("opens the run instead, where there is no Print report until it ends", async () => {
    show(hub(run("running", [step(1)])));

    expect(await screen.findByText("Did 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Report", level: 2 })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Print" })).not.toBeInTheDocument();
  });
});
