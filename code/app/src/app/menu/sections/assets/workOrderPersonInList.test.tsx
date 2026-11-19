import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const orders = [
  { id: "w1", title: "Repaint railings", state: "Doing", due_at: "2026-11-24T00:00:00Z", assigned_to: "a1", assignee_kind: "agent" },
  { id: "w2", title: "Mend the fence", state: "To do", assigned_to: "p1", assignee_kind: "actor" },
  { id: "w3", title: "Clear the gutters", state: "To do" },
  { id: "w4", title: "Sweep the square", state: "Doing", assigned_to: "p2", assignee_kind: "actor" },
];

const people: Record<string, Record<string, string>> = {
  p1: { id: "p1", display_name: "Judit Szabo", code: "AC-7" },
  p2: { id: "p2", code: "AC-1" },
};

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
  if (name === "agency_get_my_roles") return { permissions: [] };
  if (name === "taskmanager_task_list") return { items: orders };
  if (name === "taskmanager_agent_list") return { items: [{ id: "a1", agent_id: "mari", display_name: "Road Repair Crew" }] };
  if (name === "actor_get_actor") return people[given.actor_id];
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const showOrders = () => {
  const path = items.find((item) => item.title === "Work Orders")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
};

describe("the person or crew who has a job, in the Work Orders list", () => {
  it("ends the row line with the crew's name for a job held by a worker, after the due day", async () => {
    showOrders();

    expect(await screen.findByText("Doing · due Tuesday, 24 Nov · Road Repair Crew")).toBeInTheDocument();
  });

  it("ends the row line with the person's name for a job held by a person", async () => {
    showOrders();

    expect(await screen.findByText("To do · Judit Szabo")).toBeInTheDocument();
  });

  it("says Unnamed person, never the code, for a holder with no name", async () => {
    showOrders();

    expect(await screen.findByText("Doing · Unnamed person")).toBeInTheDocument();
    expect(screen.queryByText(/AC-1/)).toBeNull();
  });

  it("shows no person for a job nobody holds", async () => {
    showOrders();

    await screen.findByText("To do · Judit Szabo");
    expect(screen.getAllByText("To do")).toHaveLength(1);
  });
});
