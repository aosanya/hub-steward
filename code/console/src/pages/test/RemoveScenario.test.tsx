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
import { TestView } from "../views/TestView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const scenario = (id: string, name: string) => ({
  id,
  name,
  summary: "tries " + name,
  workflow_id: "w1",
  result: "not_run",
  last_run_id: "",
  rules: [],
});

let gone = new Set<string>();

const hub = (more: Record<string, unknown> = {}) => ({
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_scenarios: () => ({
    items: [scenario("s1", "Shop says yes"), scenario("s2", "Find it")].filter(
      (entry) => !gone.has(entry.id),
    ),
  }),
  agency_delete_scenario: (args: Record<string, unknown>) => {
    gone.add(String(args.scenario_id));
    return {};
  },
  ...more,
});

const show = (replies: Record<string, unknown> = hub()) => {
  answering(replies);
  return renderView("test", TestView);
};

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

const chooseRemove = async (index: number) => {
  await userEvent.click(
    within(cards()[index]).getByRole("button", { name: "Actions" }),
  );
  await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  gone = new Set();
});

describe("removing a scenario", () => {
  it("asks first and sends nothing until it is confirmed", async () => {
    show();
    await screen.findByText("Find it");

    await chooseRemove(0);

    expect(screen.getByText(/Remove Find it\?/)).toBeInTheDocument();
    expect(callsTo("agency_delete_scenario")).toEqual([]);
  });

  it("sends nothing when it is cancelled", async () => {
    show();
    await screen.findByText("Find it");
    await chooseRemove(0);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/Remove Find it\?/)).not.toBeInTheDocument();
    expect(callsTo("agency_delete_scenario")).toEqual([]);
  });

  it("calls agency_delete_scenario and takes the scenario out of the list", async () => {
    show();
    await screen.findByText("Find it");
    await chooseRemove(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove scenario" }),
    );

    await waitFor(() =>
      expect(callsTo("agency_delete_scenario")).toEqual([
        { scenario_id: "s2" },
      ]),
    );
    await waitFor(() =>
      expect(screen.queryByText("Find it")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Shop says yes")).toBeInTheDocument();
    expect(proposals()).toEqual([]);
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });

  it("keeps the scenario and says so when the agency refuses", async () => {
    show(
      hub({
        agency_delete_scenario: new McpError("agency_delete_scenario: down"),
      }),
    );
    await screen.findByText("Find it");
    await chooseRemove(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove scenario" }),
    );

    expect(
      await screen.findByText("Find it could not be removed."),
    ).toHaveClass("error");
    expect(screen.getByRole("link", { name: "Find it" })).toBeInTheDocument();
    expect(screen.queryByText(/Remove Find it\?/)).not.toBeInTheDocument();
  });
});
