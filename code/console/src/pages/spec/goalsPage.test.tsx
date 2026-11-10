import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { AddGoalPage } from "./goalsAdd";
import { GoalPage } from "./goalsDetail";
import { GoalList } from "./goalsList";
import { answering, clearPages, clearShown, failing, installPage, renderSpec } from "./specHarness.test-helper";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

type Tools = Record<string, (args: Record<string, unknown>) => unknown>;

const answer = (tools: Tools = {}) =>
  call.mockImplementation(async (_hub, tool, args) => {
    const run = tools[tool];
    return (run ? run((args ?? {}) as Record<string, unknown>) : []) as never;
  });

const goalRows = [
  { id: "g1", code: "G-1", title: "Open a seed library", objectives: 2 },
  { id: "g2", code: "", title: "Cut transport costs", objectives: 0 },
  { id: "g3", code: "G-3", title: "Train riders", objectives: 1 },
];

beforeEach(() => {
  clearPages();
  clearShown();
  call.mockReset();
  answer();
});

const list = (route = "/h/h1/goals", state?: unknown) =>
  renderSpec(
    <Routes>
      <Route path="/h/:hubId/goals" element={<GoalList hubId="h1" />} />
      <Route path="/h/:hubId/goals/new" element={<AddGoalPage hubId="h1" />} />
    </Routes>,
    route,
  );

describe("the Goals list", () => {
  it("lists the goals by title, each with its code, and a button to add one", async () => {
    installPage("goals", { rows: goalRows });
    list();

    await screen.findByText("G-1 · Open a seed library");
    const titles = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(titles.indexOf("Cut transport costs")).toBeLessThan(titles.indexOf("G-3 · Train riders"));
    expect(screen.getByRole("link", { name: "Add a goal" }).getAttribute("href")).toBe("/h/h1/goals?add=goal");
  });

  it("shows how many objectives a goal has once opened, and a dash for none", async () => {
    installPage("goals", { rows: goalRows });
    list();

    await userEvent.click(await screen.findByText("G-1 · Open a seed library"));
    expect(screen.getByText("2")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Cut transport costs"));
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("links each goal to its own page", async () => {
    installPage("goals", { rows: goalRows });
    list();

    await screen.findByText("G-1 · Open a seed library");
    const links = screen.getAllByRole("link", { name: "Edit" }).map((link) => link.getAttribute("href"));
    expect(links).toContain("/h/h1/goals?goal=g1");
  });

  it("narrows the goals to the search words, matching the code too", async () => {
    installPage("goals", { rows: goalRows });
    list();

    await screen.findByText("G-1 · Open a seed library");
    await userEvent.type(screen.getByPlaceholderText("Search goals"), "g-3");

    expect(screen.getByText("G-3 · Train riders")).toBeInTheDocument();
    expect(screen.queryByText("Cut transport costs")).not.toBeInTheDocument();
  });

  it("says there is nothing yet, with no search box, when the hub has no goal", async () => {
    installPage("goals", { rows: [] });
    list();

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search goals")).not.toBeInTheDocument();
  });

  it("says the page could not be loaded when the rows are refused", async () => {
    installPage("goals", {
      rows: async () => {
        throw new Error("offline");
      },
    });
    list();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});

describe("adding a goal", () => {
  const begin = async (actions: Parameters<typeof installPage>[1]["actions"]) => {
    installPage("goals", { rows: goalRows, actions });
    list("/h/h1/goals/new");
    await screen.findByText("New goal");
  };

  it("asks for the name before sending anything", async () => {
    const goals = answering("done");
    await begin({ goals });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Required: Name")).toBeInTheDocument();
    expect(goals).not.toHaveBeenCalled();
  });

  it("sends the title and description and goes back to the list when made at once", async () => {
    const goals = answering("done");
    await begin({ goals });

    await userEvent.type(screen.getByLabelText("Name"), "Open a library");
    await userEvent.type(screen.getByLabelText("Description"), "Share seeds");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(goals).toHaveBeenCalledWith("h1", { title: "Open a library", description: "Share seeds" }));
    expect(await screen.findByText("G-1 · Open a seed library")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });

  it("goes back to the list saying the change waits for approval when only proposed", async () => {
    await begin({ goals: answering("accepted") });

    await userEvent.type(screen.getByLabelText("Name"), "Open a library");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByText("G-1 · Open a seed library")).toBeInTheDocument();
  });

  it("stays on the form with the failure line when the hub refuses", async () => {
    await begin({ goals: failing() });

    await userEvent.type(screen.getByLabelText("Name"), "Open a library");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Open a library");
  });

  it("goes back to the list on Cancel without sending", async () => {
    const goals = answering("done");
    await begin({ goals });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("G-1 · Open a seed library")).toBeInTheDocument();
    expect(goals).not.toHaveBeenCalled();
  });
});

describe("one goal opened", () => {
  const goalTools: Tools = {
    agency_get_goal: () => ({ goal: { id: "g1", code: "G-1", title: "Open a seed library", description: "Share seeds between farms" } }),
    agency_list_objectives: () => [
      { id: "o1", code: "O-1", title: "Collect seeds", goal_id: "g1" },
      { id: "o2", code: "O-2", title: "Build a shelf", goal_id: "" },
      { id: "o3", code: "O-9", title: "Someone else's", goal_id: "g9" },
    ],
  };

  const page = () => renderSpec(<GoalPage hubId="h1" goalId="g1" />, "/h/h1/goals?goal=g1");

  it("shows the goal's title and code, its description and the objectives that belong to it", async () => {
    answer(goalTools);
    page();

    expect(await screen.findByRole("heading", { name: "Open a seed library" })).toBeInTheDocument();
    expect(screen.getByText("Goal G-1")).toBeInTheDocument();
    expect(screen.getByText("Share seeds between farms")).toBeInTheDocument();
    expect(screen.getByText("Collect seeds")).toBeInTheDocument();
    expect(screen.getByText("Build a shelf")).toBeInTheDocument();
    expect(screen.queryByText("Someone else's")).not.toBeInTheDocument();
  });

  it("counts the objectives and links each to its own page", async () => {
    answer(goalTools);
    page();

    await screen.findByText("Collect seeds");
    const card = screen.getByText("Goal G-1").closest(".card") as HTMLElement;
    expect(within(card).getByText("2")).toBeInTheDocument();
    const opens = screen.getAllByRole("link", { name: "Open" }).map((link) => link.getAttribute("href"));
    expect(opens).toContain("/h/h1/goals?goal=g1&objective=o1");
    expect(screen.getByRole("link", { name: "Add an objective" }).getAttribute("href")).toBe("/h/h1/goals?goal=g1&add=objective");
  });

  it("says there are no objectives when the goal has none", async () => {
    answer({ ...goalTools, agency_list_objectives: () => [] });
    page();

    await screen.findByText("Goal G-1");
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    const card = screen.getByText("Goal G-1").closest(".card") as HTMLElement;
    expect(within(card).getByText("0")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the goal cannot be read", async () => {
    answer({
      agency_get_goal: () => {
        throw new Error("gone");
      },
    });
    page();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});
