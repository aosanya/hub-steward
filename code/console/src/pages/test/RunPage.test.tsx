import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { TestView } from "../views/TestView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

vi.mock("../../data/testRun", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/testRun")>()),
  runPollMs: 10,
}));

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

const run = (
  id: string,
  result: string,
  steps: unknown[],
  more: Record<string, unknown> = {},
) => ({
  id,
  scenario_id: "s1",
  draft_version: "ver-" + id,
  result,
  stop_reason: "",
  tokens: 4200,
  started_at: "2026-10-28T10:05:00Z",
  finished_at: "",
  steps,
  ...more,
});

const hub = (get: unknown, more: Record<string, unknown> = {}) => ({
  agency_get_test_run: get,
  agency_get_scenario: {
    id: "s1",
    name: "Shop says yes",
    workflow_id: "w1",
    result: "running",
    last_run_id: "r1",
  },
  agency_list_test_runs: {
    items: [
      run("r1", "running", []),
      run("r0", "passed", [], { started_at: "2026-10-27T10:05:00Z" }),
    ],
  },
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_scenarios: {
    items: [
      {
        id: "s1",
        name: "Shop says yes",
        workflow_id: "w1",
        result: "not_run",
        last_run_id: "",
        rules: [],
      },
    ],
  },
  ...more,
});

const show = (replies: Record<string, unknown>, search = "?run=r1") => {
  answering(replies);
  return renderView("test", TestView, search);
};

const reads = () => callsTo("agency_get_test_run").length;

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("a run that is still going", () => {
  it("is read again on an interval and fills as the runner writes steps, then stops reading when it ends", async () => {
    const written = [step(1), step(2), step(3)];
    let shown = 1;
    let ended = false;
    show(
      hub(() =>
        run("r1", ended ? "passed" : "running", written.slice(0, shown)),
      ),
    );

    expect(await screen.findByText("Did 1")).toBeInTheDocument();
    expect(screen.queryByText("Did 2")).not.toBeInTheDocument();
    shown = 2;
    expect(await screen.findByText("Did 2")).toBeInTheDocument();
    shown = 3;
    ended = true;
    expect(await screen.findByText("Did 3")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Stop" }),
      ).not.toBeInTheDocument(),
    );
    const settled = reads();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(reads()).toBe(settled);
    expect(callsTo("agency_get_test_run")[0]).toEqual({ test_run_id: "r1" });
  });

  it("shows each step with who acted, who played it, what was recorded and its tokens", async () => {
    show(
      hub(() =>
        run("r1", "running", [
          step(2, { rules: [{ code: "RU-2", held: true }] }),
        ]),
      ),
    );

    const row = (await screen.findByText("Did 2")).closest(
      "section",
    ) as HTMLElement;
    expect(within(row).getByText(/Actor 2/)).toBeInTheDocument();
    expect(within(row).getByText(/Player 2/)).toBeInTheDocument();
    expect(within(row).getByText(/Recorded 2/)).toBeInTheDocument();
    expect(within(row).getByText("Step 2")).toBeInTheDocument();
    expect(within(row).getByText("2,000")).toBeInTheDocument();
    expect(within(row).getByText("RU-2 held")).toHaveClass("ok");
  });

  it("shows Running, then Waiting for a run that is queued, and offers Stop on both", async () => {
    show(hub(() => run("r1", "waiting", [])));

    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("calls the stop client once and reads the run again", async () => {
    let stopped = false;
    show(
      hub(
        () =>
          stopped
            ? run("r1", "stopped", [step(1)], {
                stop_reason: "Stopped by the designer",
              })
            : run("r1", "running", [step(1)]),
        {
          agency_stop_test_run: () => {
            stopped = true;
            return {};
          },
        },
      ),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Stop" }));

    await waitFor(() =>
      expect(callsTo("agency_stop_test_run")).toEqual([{ test_run_id: "r1" }]),
    );
    expect(
      await screen.findByText("Stopped by the designer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Did 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop" }),
    ).not.toBeInTheDocument();
    expect(callsTo("agency_stop_test_run")).toHaveLength(1);
  });
});

describe("the one primary button in the title row", () => {
  it.each(["passed", "failed", "stopped"])(
    "is Print report, a link to the report, once the run has %s",
    async (result) => {
      show(hub(() => run("r1", result, [step(1)])));

      const button = await screen.findByRole("link", { name: "Print report" });
      expect(button).toHaveAttribute("href", "/h/h1/test?run=r1&report=1");
      expect(button).toHaveClass("btn", "primary");
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    },
  );

  it.each(["running", "waiting"])("is Stop, with no Print report, while the run is %s", async (result) => {
    show(hub(() => run("r1", result, [step(1)])));

    expect(await screen.findByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Print report" })).not.toBeInTheDocument();
  });

  it("turns from Stop into Print report when the run ends", async () => {
    let ended = false;
    show(hub(() => run("r1", ended ? "passed" : "running", [step(1)])));
    await screen.findByRole("button", { name: "Stop" });

    ended = true;

    expect(await screen.findByRole("link", { name: "Print report" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("opens the report of the run when pressed", async () => {
    show(hub(() => run("r1", "passed", [step(1)])));

    await userEvent.click(await screen.findByRole("link", { name: "Print report" }));

    expect(await screen.findByRole("heading", { name: "Report", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
  });
});

describe("a run that ended", () => {
  it("offers no Stop on a passed run", async () => {
    show(hub(() => run("r1", "passed", [step(1)])));

    expect(await screen.findByText("Did 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop" }),
    ).not.toBeInTheDocument();
  });

  it("shows Expected and Found at the failing step, with the rule chip failed and the three buttons", async () => {
    show(
      hub(() =>
        run("r1", "failed", [
          step(1, { rules: [{ code: "RU-7", held: true }] }),
          step(2, {
            failed: true,
            expected: "One message to each shop",
            found: "A second ask",
            rules: [{ code: "RU-7", held: false }],
          }),
        ]),
      ),
    );

    const row = (await screen.findByText("Did 2")).closest(
      "section",
    ) as HTMLElement;
    expect(within(row).getByText("Expected")).toBeInTheDocument();
    expect(
      within(row).getByText(/One message to each shop/),
    ).toBeInTheDocument();
    expect(within(row).getByText("Found")).toBeInTheDocument();
    expect(within(row).getByText(/A second ask/)).toBeInTheDocument();
    expect(within(row).queryByText(/Recorded 2/)).not.toBeInTheDocument();
    expect(within(row).getByText("RU-7 failed")).toHaveClass("bad");
    expect(
      within(row).getByRole("link", { name: "Open the rule" }),
    ).toHaveAttribute("href", "/h/h1/roles");
    expect(
      within(row).getByRole("button", { name: "Run again" }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Why did this fail?" }),
    ).toBeInTheDocument();
    const earlier = screen.getByText("Did 1").closest("section") as HTMLElement;
    expect(
      within(earlier).queryByRole("button", { name: "Run again" }),
    ).not.toBeInTheDocument();
    expect(within(earlier).getByText("RU-7 held")).toHaveClass("ok");
  });

  it("runs the scenario again from the failing step and opens the new run", async () => {
    show(
      hub(
        (args: Record<string, unknown>) =>
          args.test_run_id === "r9"
            ? run("r9", "running", [step(7)])
            : run("r1", "failed", [
                step(2, { failed: true, expected: "E", found: "F" }),
              ]),
        {
          agency_run_scenario: {
            id: "r9",
            scenario_id: "s1",
            result: "running",
          },
        },
      ),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Run again" }),
    );

    await waitFor(() =>
      expect(callsTo("agency_run_scenario")).toEqual([{ scenario_id: "s1" }]),
    );
    expect(await screen.findByText("Did 7")).toBeInTheDocument();
  });

  it("shows Budget reached on a stopped run and keeps the steps done so far", async () => {
    show(
      hub(() =>
        run("r1", "stopped", [step(1), step(2)], {
          stop_reason: "Budget reached",
          tokens: 30000,
        }),
      ),
    );

    expect(await screen.findByText("Did 1")).toBeInTheDocument();
    expect(screen.getByText("Did 2")).toBeInTheDocument();
    expect(screen.getAllByText("Stopped").length).toBeGreaterThan(0);
    expect(screen.getByText("Budget reached")).toBeInTheDocument();
    expect(screen.getByText("30,000")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop" }),
    ).not.toBeInTheDocument();
  });

  it("opens an earlier run from the Runs list, marked with the draft it ran on", async () => {
    show(
      hub((args: Record<string, unknown>) =>
        args.test_run_id === "r0"
          ? run("r0", "passed", [step(5)], { draft_version: "ver-r0" })
          : run("r1", "passed", [step(1)]),
      ),
    );
    await screen.findByText("Did 1");
    const list = screen.getByRole("heading", { name: "Runs" }).parentElement
      ?.parentElement as HTMLElement;
    expect(within(list).getByText("ver-r0")).toBeInTheDocument();
    expect(within(list).getByText("ver-r1")).toBeInTheDocument();
    expect(within(list).getAllByRole("link", { name: "Open" })).toHaveLength(1);

    await userEvent.click(within(list).getByRole("link", { name: "Open" }));

    expect(await screen.findByText("Did 5")).toBeInTheDocument();
    expect(screen.queryByText("Did 1")).not.toBeInTheDocument();
    expect(
      callsTo("agency_get_test_run").some((args) => args.test_run_id === "r0"),
    ).toBe(true);
  });

  it("says the page could not be loaded when the run cannot be read", async () => {
    show(hub(new McpError("agency_get_test_run: gone")));
    expect(
      await screen.findByText("The page could not be loaded."),
    ).toBeInTheDocument();
  });
});

describe("pressing Run on a scenario card", () => {
  it("opens the new run at once", async () => {
    show(
      hub(() => run("r9", "running", [step(4)]), {
        agency_run_scenario: { id: "r9", scenario_id: "s1", result: "running" },
      }),
      "",
    );
    await screen.findByText("Shop says yes");

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Run" }));

    expect(await screen.findByText("Did 4")).toBeInTheDocument();
    expect(callsTo("agency_run_scenario")).toEqual([{ scenario_id: "s1" }]);
  });

  it("shows the sentence the agency refuses with and stays on the list", async () => {
    show(
      hub(() => run("r9", "running", []), {
        agency_run_scenario: new McpError(
          "agency_run_scenario: Mark a default AI account first.",
        ),
      }),
      "",
    );
    await screen.findByText("Shop says yes");

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Run" }));

    expect(
      await screen.findByText("Mark a default AI account first."),
    ).toHaveClass("error");
    expect(screen.getByText("Shop says yes")).toBeInTheDocument();
  });
});
