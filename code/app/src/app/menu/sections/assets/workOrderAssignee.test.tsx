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

const workers = [
  { id: "a1", agent_id: "mari", display_name: "Mari Kovacs" },
  { id: "a2", agent_id: "peter", display_name: "Peter Nagy" },
  { id: "a3", agent_id: "anna", display_name: "Anna Toth" },
];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "taskmanager_task_list") return { items: [order] };
  if (name === "taskmanager_task_read") return { item: order };
  if (name === "taskmanager_agent_list") return { items: workers };
  if (name === "taskmanager_task_assign") {
    if (refusal) throw new mcp.McpError(`taskmanager_task_assign: ${refusal}`);
    order = { ...order, assigned_to: given.agent_id, assignee_kind: "agent" };
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["task.assign"];
  refusal = "";
  order = { id: "w1", title: "Repaint railings", state: "Doing", assigned_to: "a1", assignee_kind: "agent" };
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

describe("giving a work order to a worker from its detail", () => {
  it("shows the assignee by name, assigns another worker for a caller with task.assign and shows that name", async () => {
    await openOrder();
    expect(await screen.findByText("Mari Kovacs")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Assign" }));
    const choices = await screen.findByRole("group", { name: "Assign to" });
    expect(within(choices).getByRole("button", { name: /Mari Kovacs/ })).toHaveAttribute("aria-current", "true");
    await userEvent.click(within(choices).getByRole("button", { name: "Peter Nagy" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "taskmanager_task_assign", { taskID: "w1", agent_id: "a2" }));
    expect(await screen.findByText("Peter Nagy")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Assign to" })).toBeNull();
    expect(screen.queryByText("a2")).toBeNull();
  });

  it("shows the assignee but no Assign to a caller without task.assign", async () => {
    permissions = ["task.read"];
    await openOrder();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(await screen.findByText("Mari Kovacs")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
  });

  it("shows the hub's own words when the assignment is refused", async () => {
    refusal = "agencies: backlog access forbidden: assigning needs Can move on the backlog";
    await openOrder();

    await userEvent.click(await screen.findByRole("button", { name: "Assign" }));
    const choices = await screen.findByRole("group", { name: "Assign to" });
    await userEvent.click(within(choices).getByRole("button", { name: "Peter Nagy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("backlog access forbidden: assigning needs Can move on the backlog");
    expect(screen.getByRole("group", { name: "Assign to" })).toBeInTheDocument();
  });
});
