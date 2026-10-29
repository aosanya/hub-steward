import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import {
  answering,
  callsTo,
  proposals,
  renderView,
} from "../spec/usersTesting";
import { TestView } from "./TestView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const scenario = (
  id: string,
  name: string,
  result: string,
  more: Record<string, unknown> = {},
) => ({
  id,
  name,
  summary: "tries " + name,
  workflow_id: "w1",
  workflow: "Buy now",
  result,
  last_run_id: "",
  rules: [],
  ...more,
});

const run = (
  id: string,
  result: string,
  tokens: number,
  more: Record<string, unknown> = {},
) => ({
  id,
  scenario_id: "s1",
  result,
  tokens,
  started_at: "2026-10-28T10:05:00Z",
  steps: [],
  ...more,
});

const hub = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_scenarios: {
    items: [
      scenario("s1", "Shop says yes", "passed", {
        last_run_id: "r1",
        rules: ["RU-1", "RU-2"],
      }),
      scenario("s2", "Find it", "failed", {
        last_run_id: "r2",
        rules: ["RU-7"],
      }),
      scenario("s3", "Farmer stays silent", "not_run", { rules: ["RU-3"] }),
    ],
  },
  agency_list_test_runs: (args: Record<string, unknown>) =>
    args.scenario_id === "s1"
      ? [
          run("r1", "passed", 4200),
          run("r0", "failed", 900, { started_at: "2026-10-27T10:05:00Z" }),
        ]
      : args.scenario_id === "s2"
        ? [
            run("r2", "failed", 3100, {
              steps: [{ rules: [{ code: "RU-7", held: false }] }],
            }),
          ]
        : [],
  agency_list_rules: {
    items: [
      { code: "RU-1", text: "A farmer is in an order only after saying yes" },
      { code: "RU-3", text: "The coordinator decides about silence" },
      { code: "RU-7", text: "Ask each ticked shop once" },
      { code: "RU-9", text: "Nobody tries this" },
    ],
  },
  agency_get_scenario: {
    ...scenario("s1", "Shop says yes", "passed", {
      last_run_id: "r1",
      rules: ["RU-1"],
    }),
    actors: [
      { id: "a1", name: "Farmer 1", kind: "role", role_name: "Farmer" },
      { id: "system", name: "System", kind: "system", built_in: true },
    ],
    blocks: [
      {
        step_id: "i1",
        title: "Ask",
        kind: "fill_form",
        action: "Fills the form",
        actor: "Farmer 1",
        fields: [
          { prompt: "Enter the product", free: false, value: "urea" },
          { prompt: "Enter the bags", free: true },
        ],
      },
    ],
  },
  agency_list_workflows: {
    items: [
      { id: "w1", name: "Buy now" },
      { id: "w2", name: "Group order" },
    ],
  },
  agency_list_work_items: {
    items: [
      {
        id: "i1",
        workflow_id: "w1",
        title: "Ask",
        role_id: "r-farmer",
        questions: [{ prompt: "Enter the product" }],
      },
      {
        id: "i2",
        workflow_id: "w2",
        title: "Start",
        role_id: "r-coordinator",
        questions: [],
      },
    ],
  },
  agency_list_pickers: {
    actors: [
      { id: "r-farmer", name: "Farmer", kind: "role" },
      { id: "r-coordinator", name: "Coordinator", kind: "role" },
    ],
    answer_types: ["free_text"],
  },
};

const show = (replies: Parameters<typeof answering>[0] = hub, search = "") => {
  answering(replies);
  return renderView("test", TestView, search);
};

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Test page list", () => {
  it("shows one card per scenario with its result, what it tries, its last run and tokens", async () => {
    show();

    await screen.findByText("Shop says yes");

    expect(cards()).toHaveLength(3);
    const first = within(cards()[2]);
    expect(first.getByRole("link", { name: "Shop says yes" })).toHaveAttribute(
      "href",
      "/h/h1/test?open=s1",
    );
    expect(first.getByText("Passed")).toHaveClass("tag", "ok");
    expect(first.getByText("tries Shop says yes")).toBeInTheDocument();
    expect(first.getByText(/Tokens 4,200/)).toBeInTheDocument();
    expect(within(cards()[1]).getByText("Failed")).toHaveClass("tag", "bad");
    expect(within(cards()[0]).getByText("Not run yet")).toHaveClass(
      "tag",
      "mute",
    );
    expect(within(cards()[0]).getByText(/Last run —/)).toBeInTheDocument();
  });

  it("reads the scenarios of the open draft and the runs of each scenario that has run", async () => {
    show();

    await screen.findByText("Shop says yes");

    expect(callsTo("agency_list_scenarios")).toEqual([{ draft_id: "d1" }]);
    expect(callsTo("agency_list_test_runs")).toEqual([
      { scenario_id: "s1" },
      { scenario_id: "s2" },
    ]);
  });

  it("totals the tokens of the last runs", async () => {
    show();

    expect(
      await screen.findByText("Tokens in the last run of all scenarios: 7,300"),
    ).toBeInTheDocument();
  });

  it("filters to the failed scenarios with Failed only", async () => {
    show();
    await screen.findByText("Shop says yes");

    await userEvent.click(screen.getByRole("switch", { name: "Failed only" }));

    expect(cards()).toHaveLength(1);
    expect(screen.getByText("Find it")).toBeInTheDocument();
  });

  it("says Run all scenarios, then Run 2 selected once two rows are ticked", async () => {
    show();
    await screen.findByText("Shop says yes");
    expect(
      screen.getByRole("button", { name: "Run all scenarios" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Shop says yes" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Find it" }),
    );

    expect(
      screen.getByRole("button", { name: "Run 2 selected" }),
    ).toBeInTheDocument();
  });

  it("runs every scenario of the draft with no names when none is ticked", async () => {
    show({ ...hub, agency_run_scenarios: [] });
    await screen.findByText("Shop says yes");

    await userEvent.click(
      screen.getByRole("button", { name: "Run all scenarios" }),
    );

    await waitFor(() =>
      expect(callsTo("agency_run_scenarios")).toEqual([
        { draft_id: "d1", scenario_ids: [] },
      ]),
    );
  });

  it("runs the ticked scenarios by name", async () => {
    show({ ...hub, agency_run_scenarios: [] });
    await screen.findByText("Shop says yes");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Find it" }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Run 1 selected" }),
    );

    await waitFor(() =>
      expect(callsTo("agency_run_scenarios")).toEqual([
        { draft_id: "d1", scenario_ids: ["s2"] },
      ]),
    );
  });

  it("shows Running on the scenarios being run and lists again when the run ends", async () => {
    let finish: (value: unknown) => void = () => {};
    show({
      ...hub,
      agency_run_scenarios: () => new Promise((resolve) => (finish = resolve)),
    });
    await screen.findByText("Shop says yes");

    await userEvent.click(
      screen.getByRole("button", { name: "Run all scenarios" }),
    );

    expect(
      await screen.findByRole("button", { name: "Running 3" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Running")).toHaveLength(3);
    finish([]);
    await screen.findByRole("button", { name: "Run all scenarios" });
    expect(callsTo("agency_list_scenarios")).toHaveLength(2);
  });

  it("runs one scenario from its Actions menu, saying Run again for one that has run", async () => {
    show({ ...hub, agency_run_scenario: {} });
    await screen.findByText("Shop says yes");

    await userEvent.click(
      within(cards()[0]).getByRole("button", { name: "Actions" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Run" }));
    await waitFor(() =>
      expect(callsTo("agency_run_scenario")).toEqual([{ scenario_id: "s3" }]),
    );
    await screen.findByText("Shop says yes");

    await userEvent.click(
      within(cards()[1]).getByRole("button", { name: "Actions" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Run again" }),
    ).toBeInTheDocument();
  });

  it("offers Open last run and Print report only for a scenario that has run", async () => {
    show();
    await screen.findByText("Shop says yes");

    await userEvent.click(
      within(cards()[0]).getByRole("button", { name: "Actions" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Open last run" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute(
      "href",
      "/h/h1/test?edit=s3",
    );

    await userEvent.click(
      within(cards()[2]).getByRole("button", { name: "Actions" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Open last run" }),
    ).toHaveAttribute("href", "/h/h1/test?run=r1");
    expect(
      screen.getByRole("menuitem", { name: "Print report" }),
    ).toHaveAttribute("href", "/h/h1/test?run=r1&report=1");
  });

  it("carries Add a scenario inside the empty card when there is none", async () => {
    show({ ...hub, agency_list_scenarios: { items: [] } });

    expect(await screen.findByText("No scenario yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add a scenario" }),
    ).toBeInTheDocument();
  });

  it("says the page could not be loaded when the scenarios cannot be read", async () => {
    show({
      ...hub,
      agency_list_scenarios: new McpError("agency_list_scenarios: down"),
    });

    expect(
      await screen.findByText("The page could not be loaded."),
    ).toHaveClass("error");
  });
});

describe("the Add a scenario form", () => {
  it("saves agency_create_scenario straight from the form with the name, workflow, what it tries, actors and fixed inputs, then shows the list", async () => {
    show({ ...hub, agency_create_scenario: {} }, "?add=1");
    await screen.findByRole("heading", { name: "New scenario" });

    await userEvent.type(screen.getByLabelText(/^Name/), "Silent farmer");
    await userEvent.type(
      screen.getByLabelText("What it tries"),
      "waits for the coordinator",
    );
    await userEvent.click(screen.getByRole("button", { name: "Actors" }));
    await userEvent.click(screen.getByRole("button", { name: "Add an actor" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Actor" }),
      "Farmer 2",
    );
    await userEvent.click(screen.getByRole("button", { name: "Steps" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Enter the product" }),
      "urea",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(callsTo("agency_create_scenario")).toEqual([
        {
          draft_id: "d1",
          name: "Silent farmer",
          summary: "waits for the coordinator",
          workflow_id: "w1",
          actors: [{ name: "Farmer 2", role_id: "r-farmer" }],
          inputs: [{ step_id: "i1", field: "Enter the product", value: "urea" }],
        },
      ]),
    );
    expect(proposals()).toEqual([]);
    expect(await screen.findByText("Shop says yes")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "New scenario" }),
    ).not.toBeInTheDocument();
  });

  it("says the change could not be sent and keeps the form when agency_create_scenario fails", async () => {
    show(
      { ...hub, agency_create_scenario: new McpError("agency_create_scenario: boom") },
      "?add=1",
    );
    await screen.findByRole("heading", { name: "New scenario" });

    await userEvent.type(screen.getByLabelText(/^Name/), "Silent farmer");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The change could not be sent.",
    );
    expect(
      screen.getByRole("heading", { name: "New scenario" }),
    ).toBeInTheDocument();
    expect(proposals()).toEqual([]);
  });

  it("adds the server's reason to the alert when agency_create_scenario fails", async () => {
    show(
      { ...hub, agency_create_scenario: new McpError("agency_create_scenario: the workflow is not in this draft") },
      "?add=1",
    );
    await screen.findByRole("heading", { name: "New scenario" });

    await userEvent.type(screen.getByLabelText(/^Name/), "Silent farmer");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The change could not be sent. agency_create_scenario: the workflow is not in this draft",
    );
  });

  it("starts a draft and creates the scenario in it when none is open", async () => {
    show(
      {
        ...hub,
        agency_list_drafts: { items: [] },
        agency_create_draft: { id: "d7" },
        agency_create_scenario: {},
      },
      "?add=1",
    );
    await screen.findByRole("heading", { name: "New scenario" });

    await userEvent.type(screen.getByLabelText(/^Name/), "Silent farmer");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(callsTo("agency_create_scenario")).toEqual([
        expect.objectContaining({ draft_id: "d7", name: "Silent farmer" }),
      ]),
    );
  });

  it("asks for a name before it sends anything", async () => {
    show(hub, "?add=1");
    await screen.findByRole("heading", { name: "New scenario" });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Required: Name",
    );
    expect(proposals()).toEqual([]);
  });

  it("holds Save while two actors share a name", async () => {
    show(hub, "?add=1");
    await screen.findByRole("heading", { name: "New scenario" });
    await userEvent.click(screen.getByRole("button", { name: "Actors" }));
    await userEvent.click(screen.getByRole("button", { name: "Add an actor" }));
    await userEvent.click(screen.getByRole("button", { name: "Add an actor" }));
    const names = screen.getAllByRole("textbox", { name: "Actor" });
    await userEvent.type(names[0], "Farmer 1");
    await userEvent.type(names[1], "farmer 1");

    expect(
      screen.getByText("Names are unique in a scenario."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("one scenario", () => {
  it("shows the Scenario tab with what it tries, its workflow, last run, result and runs", async () => {
    show(
      {
        ...hub,
        agency_list_test_runs: [
          run("r1", "passed", 4200),
          run("r0", "failed", 900),
        ],
      },
      "?open=s1",
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Shop says yes" }),
    ).toBeInTheDocument();
    expect(callsTo("agency_get_scenario")).toEqual([{ scenario_id: "s1" }]);
    const card = screen
      .getByRole("heading", { name: "Scenario" })
      .closest("section") as HTMLElement;
    expect(
      within(card).getByText("Workflow").nextElementSibling,
    ).toHaveTextContent("Buy now");
    expect(
      within(card).getByText("Result").nextElementSibling,
    ).toHaveTextContent("Passed");
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/h/h1/test?edit=s1",
    );
    expect(
      within(
        screen.getByRole("heading", { name: "Runs" }).closest("div")!
          .parentElement!,
      ).getAllByRole("row"),
    ).toHaveLength(3);
  });

  it("opens the edit form on the Actors tab, the built-in actors marked", async () => {
    show(hub, "?open=s1&tab=actors");

    expect(await screen.findByDisplayValue("Farmer 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("opens the edit form on the Steps tab with each fixed answer in a box", async () => {
    show(hub, "?open=s1&tab=blocks");

    expect(await screen.findByLabelText("Enter the product")).toHaveValue(
      "urea",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("saves agency_update_scenario straight from the edit form and keeps the workflow", async () => {
    show({ ...hub, agency_update_scenario: {} }, "?edit=s1");
    const name = await screen.findByLabelText(/^Name/);

    await userEvent.clear(name);
    await userEvent.type(name, "Shop agrees");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(callsTo("agency_update_scenario")).toEqual([
        {
          draft_id: "d1",
          scenario_id: "s1",
          name: "Shop agrees",
          summary: "tries Shop says yes",
          workflow_id: "w1",
        },
      ]),
    );
    expect(proposals()).toEqual([]);
  });

  it("says there is nothing here for a scenario the draft does not have", async () => {
    show({ ...hub, agency_get_scenario: null }, "?open=nobody");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });
});

describe("which rules held", () => {
  it("marks each rule Held, Failed or Not tested yet and says which scenario shows it", async () => {
    show(hub, "?rules=1");

    const row = async (code: string) =>
      (await screen.findByText(code)).closest("tr") as HTMLElement;

    expect(within(await row("RU-1")).getByText("Held")).toHaveClass("ok");
    expect(
      within(await row("RU-1")).getByText("Shown by Shop says yes"),
    ).toBeInTheDocument();
    expect(within(await row("RU-7")).getByText("Failed")).toHaveClass("bad");
    expect(
      within(await row("RU-7")).getByText("Failed in Find it"),
    ).toBeInTheDocument();
    expect(within(await row("RU-3")).getByText("Not tested yet")).toHaveClass(
      "mute",
    );
    expect(
      within(await row("RU-9")).getByText("No scenario tries it yet"),
    ).toBeInTheDocument();
  });

  it("opens the run page for Open last run", async () => {
    show(
      {
        ...hub,
        agency_get_test_run: run("r1", "passed", 4200, {
          steps: [
            {
              step_id: "st1",
              step: "Ask",
              actor: "Farmer 1",
              did: "Asked for lime",
              recorded: "A request",
              tokens: 1800,
            },
          ],
        }),
      },
      "?run=r1",
    );

    expect(await screen.findByText("Asked for lime")).toBeInTheDocument();
  });
});
