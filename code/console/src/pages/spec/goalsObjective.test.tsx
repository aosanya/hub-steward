import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { ObjectivePage } from "./goalsObjective";
import { renderSpec } from "./specHarness.test-helper";
import { answering, callsTo } from "./usersFixtures.test-helper";

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
