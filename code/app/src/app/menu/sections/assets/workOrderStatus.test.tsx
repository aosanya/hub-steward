import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let order: Record<string, string>;
let refusal: string;

const stepNames: Record<string, string> = { "step-todo": "To do", "step-doing": "Doing", "step-review": "Review" };

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "taskmanager_task_list") return { items: [order] };
  if (name === "taskmanager_task_read") return { item: order };
  if (name === "taskmanager_backlog_list") {
    return { items: [{ id: "works", name: "Works", steps: Object.entries(stepNames).map(([id, name]) => ({ id, name })) }] };
  }
  if (name === "taskmanager_task_move_to_step") {
    if (refusal) throw new mcp.McpError(`taskmanager_task_move_to_step: ${refusal}`);
    order = { ...order, step: given.step, state: stepNames[given.step] };
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["task.edit"];
  refusal = "";
  order = { id: "w1", title: "Repaint railings", state: "Doing", backlog: "works", step: "step-doing" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openOrder = async () => {
  const path = items.find((item) => item.title === "Work Orders")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Repaint railings/ }));
};

describe("changing the state of a work order from its detail", () => {
  it("moves it to another step for a caller with task.edit and shows the new state", async () => {
    await openOrder();

    await userEvent.click(await screen.findByRole("button", { name: "Change state" }));
    const choices = await screen.findByRole("group", { name: "Move to" });
    expect(within(choices).getByRole("button", { name: /Doing/ })).toHaveAttribute("aria-current", "true");
    await userEvent.click(within(choices).getByRole("button", { name: "Review" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "taskmanager_task_move_to_step", { taskID: "w1", backlog: "works", step: "step-review" }));
    expect((await screen.findAllByText("Review")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("group", { name: "Move to" })).toBeNull();
  });

  it("shows no Change state to a caller without task.edit", async () => {
    permissions = ["task.read"];
    await openOrder();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Change state" })).toBeNull();
  });

  it("shows the hub's own words when the move is refused", async () => {
    refusal = "agencies: backlog access forbidden: moving needs Can move on both backlogs";
    await openOrder();

    await userEvent.click(await screen.findByRole("button", { name: "Change state" }));
    const choices = await screen.findByRole("group", { name: "Move to" });
    await userEvent.click(within(choices).getByRole("button", { name: "Review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("backlog access forbidden: moving needs Can move on both backlogs");
    expect(screen.getByRole("group", { name: "Move to" })).toBeInTheDocument();
  });
});
