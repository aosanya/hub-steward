import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { ObjectivePage } from "./goalsObjective";
import { chooseAction } from "../../ui/pageHeader.test-support";
import { answering as actionAnswering, clearPages, failing, installPage, renderSpec, type PageSetup } from "./specHarness.test-helper";
import { answering, callsTo } from "./usersFixtures.test-helper";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

vi.mock("../objectives/ObjectiveFlow", () => ({
  ObjectiveFlow: ({ objectiveId }: { objectiveId: string }) => <p>Flow of {objectiveId}</p>,
}));

const objective = { id: "o1", code: "O2", title: "Plant by March", description: "Every member plants early", goal_id: "g1" };

const goal = { id: "g1", code: "G1", title: "Feed the village", description: "" };

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

const open = (goalId = "") => renderSpec(<ObjectivePage hubId="h1" objectiveId="o1" goalId={goalId} />);

describe("one objective opened", () => {
  it("shows the objective with its code, its description and the goal it serves, linked to that goal", async () => {
    answering({ agency_get_objective: { objective }, agency_get_goal: { goal } });
    open();

    expect(await screen.findByText("Every member plants early")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Objective O2" })).toBeInTheDocument();
    expect(screen.getByText("Plant by March")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "G1 · Feed the village" });
    expect(link).toHaveAttribute("href", "/h/h1/goals?goal=g1");
    expect(screen.getByText("Flow of o1")).toBeInTheDocument();
  });

  it("reads the goal the objective names, not the one in the address", async () => {
    answering({ agency_get_objective: { objective }, agency_get_goal: { goal } });
    open("g-from-address");

    await screen.findByText("Feed the village", { exact: false });
    expect(callsTo("agency_get_goal")).toEqual([{ goal_id: "g1" }]);
  });

  it("falls back to the goal in the address when the objective names none", async () => {
    answering({ agency_get_objective: { objective: { ...objective, goal_id: "" } }, agency_get_goal: { goal } });
    open("g1");

    await screen.findByText("Feed the village", { exact: false });
    expect(callsTo("agency_get_goal")).toEqual([{ goal_id: "g1" }]);
  });

  it("shows no goal row when there is no goal to read", async () => {
    answering({ agency_get_objective: { objective: { ...objective, goal_id: "" } } });
    open();

    await screen.findByText("Every member plants early");
    expect(callsTo("agency_get_goal")).toEqual([]);
    expect(screen.queryByText("Goal")).not.toBeInTheDocument();
  });

  it("still shows the objective when the goal cannot be read", async () => {
    answering({ agency_get_objective: { objective }, agency_get_goal: new Error("forbidden") });
    open();

    expect(await screen.findByText("Every member plants early")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Feed the village/ })).not.toBeInTheDocument();
  });

  it("names an objective with no code and no title just Objective", async () => {
    answering({ agency_get_objective: { objective: { id: "o1" } } });
    open();

    expect(await screen.findAllByText("Objective")).not.toHaveLength(0);
    expect(screen.queryByRole("heading", { name: /Objective O/ })).not.toBeInTheDocument();
  });

  it("says the page could not be loaded when the objective cannot be read", async () => {
    answering({ agency_get_objective: new Error("down") });
    open();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("Flow of o1")).not.toBeInTheDocument();
  });
});

describe("changing the objective that is open", () => {
  beforeEach(() => {
    clearPages();
    answering({ agency_get_objective: { objective }, agency_get_goal: { goal } });
  });

  const openWith = (actions: PageSetup["actions"], goalId = "g1") => {
    installPage("goals", { actions });
    const Objectives = () => (useSearchParams()[0].get("objective") ? <ObjectivePage hubId="h1" objectiveId="o1" goalId={goalId} /> : <p>Back on the list</p>);
    renderSpec(
      <Routes>
        <Route path="/h/:hubId/goals" element={<Objectives />} />
        <Route path="/h/:hubId/objectives" element={<Objectives />} />
      </Routes>,
      "/h/h1/goals?objective=o1",
    );
  };

  it("offers Edit, which opens the title and the description to change, and sends them", async () => {
    const edit = actionAnswering("done");
    openWith({ objective: edit });
    await screen.findByText("Every member plants early");

    await chooseAction("Edit");
    expect(screen.getByLabelText("Title *")).toHaveValue("Plant by March");
    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.type(screen.getByLabelText("Description"), "Plant before the rains");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(edit).toHaveBeenCalledWith("h1", { objective_id: "o1", title: "Plant by March", description: "Plant before the rains" }));
    await waitFor(() => expect(screen.queryByLabelText("Title *")).not.toBeInTheDocument());
  });

  it("asks first before removing, naming the objective, and leaves it alone on Cancel", async () => {
    const remove = actionAnswering("done");
    openWith({ removeObjective: remove });
    await screen.findByText("Every member plants early");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Remove the objective Plant by March? Its links to workflows go with it.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the objective by its id and goes back to the goal it served", async () => {
    const remove = actionAnswering("done");
    installPage("goals", { actions: { removeObjective: remove } });
    const Here = () => {
      const [params] = useSearchParams();
      return params.get("objective") ? <ObjectivePage hubId="h1" objectiveId="o1" goalId="g1" /> : <p>Goal page of {params.get("goal")}</p>;
    };
    renderSpec(
      <Routes>
        <Route path="/h/:hubId/goals" element={<Here />} />
      </Routes>,
      "/h/h1/goals?goal=g1&objective=o1",
    );
    await screen.findByText("Every member plants early");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove objective" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("h1", { objective_id: "o1" }));
    expect(await screen.findByText("Goal page of g1")).toBeInTheDocument();
  });

  it("goes back to the objectives list when it was opened from there", async () => {
    const remove = actionAnswering("done");
    openWith({ removeObjective: remove }, "");
    await screen.findByText("Every member plants early");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove objective" }));

    expect(await screen.findByText("Back on the list")).toBeInTheDocument();
  });

  it("keeps the question open and names the refusal of the hub when the removal fails", async () => {
    openWith({ removeObjective: failing() });
    await screen.findByText("Every member plants early");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove objective" }));

    expect(await screen.findByText("offline")).toBeInTheDocument();
  });
});
