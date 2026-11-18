import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { assetPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let landed = "";
let refusal = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  permissions = ["task.edit"];
  refusal = "";
  landed = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
    if (tool === "actor_list_actors") return { items: [{ id: "p1", display_name: "Kovács Anna" }, { id: "p2", display_name: "Nagy Béla" }] };
    if (tool === "actor_get_my_actor") return { id: "me1" };
    if (tool === "taskmanager_task_create" || tool === "taskmanager_repeating_task_create") {
      if (refusal) throw new mcp.McpError(refusal);
      return { id: "new1" };
    }
    if (tool === "taskmanager_task_list") return { items: [{ id: "w1", title: "Repaint railings", state: "To do" }] };
    if (tool === "taskmanager_repeating_task_list") return { items: [{ id: "s1", title: "Grease the gates", schedule_rule: "FREQ=WEEKLY;BYDAY=MO", schedule_start: "2026-12-07T00:00:00Z" }] };
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const callsTo = (tool: string) => called.mock.calls.filter(([, name]) => name === tool);

const lists = [
  { screen: "Work Orders", path: () => assetPaths.workOrders.path(), add: "Add work order", opened: () => assetPaths.workOrderNew.path() },
  { screen: "Maintenance Schedule", path: () => assetPaths.maintenance.path(), add: "Add schedule", opened: () => assetPaths.maintenanceNew.path() },
];

describe.each(lists)("the $screen list", ({ path, add, opened }) => {
  it("carries the full-width Add button above Search for a holder of task.edit", async () => {
    show(path());
    const button = await screen.findByRole("button", { name: add });
    const search = await screen.findByLabelText("Search");
    expect(button.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no Add button without task.edit", async () => {
    permissions = [];
    show(path());
    await waitFor(() => expect(callsTo("agency_get_my_roles").length).toBeGreaterThan(0));
    await screen.findByLabelText("Search");
    expect(screen.queryByRole("button", { name: add })).not.toBeInTheDocument();
  });

  it("opens its one Add screen and makes no call until Save", async () => {
    show(path());
    await userEvent.click(await screen.findByRole("button", { name: add }));
    await waitFor(() => expect(landed).toBe(opened()));
    expect(await screen.findByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(callsTo("taskmanager_task_create")).toHaveLength(0);
    expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(0);
  });
});

describe("the work order Add screen", () => {
  it("saves with taskmanager_task_create and the title, then returns to the list", async () => {
    show(assetPaths.workOrderNew.path());
    await userEvent.type(await screen.findByLabelText("Title"), "Repaint railings");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo("taskmanager_task_create")).toHaveLength(1));
    expect(callsTo("taskmanager_task_create")[0][2]).toEqual({ title: "Repaint railings" });
    await waitFor(() => expect(landed).toBe(assetPaths.workOrders.path()));
  });

  it("says the refusal in words and stays on the screen", async () => {
    refusal = "tool error: that title is taken";
    show(assetPaths.workOrderNew.path());
    await userEvent.type(await screen.findByLabelText("Title"), "Repaint railings");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/title is taken/)).toBeInTheDocument();
    expect(landed).toBe(assetPaths.workOrderNew.path());
  });

  it("tells a caller without task.edit that they may not add", async () => {
    permissions = [];
    show(assetPaths.workOrderNew.path());
    expect(await screen.findByText("You may not add this.")).toBeInTheDocument();
  });
});

describe("the maintenance schedule Add screen", () => {
  const fill = async () => {
    await userEvent.type(await screen.findByLabelText("Title"), "Grease the gates");
    await userEvent.click(await screen.findByLabelText("Every week"));
    await userEvent.click(await screen.findByLabelText("Monday"));
    await userEvent.type(screen.getByLabelText("Starting on"), "2026-12-07");
  };

  it("saves with taskmanager_repeating_task_create, the schedule and the signed-in person as assignee, then returns to the list", async () => {
    show(assetPaths.maintenanceNew.path());
    await fill();
    await waitFor(() => expect(callsTo("actor_get_my_actor").length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(1));
    expect(callsTo("taskmanager_repeating_task_create")[0][2]).toMatchObject({
      title: "Grease the gates",
      schedule: { start: "2026-12-07T00:00:00Z", zone: "UTC", rule: "FREQ=WEEKLY;BYDAY=MO" },
      assignee_kind: "actor",
      assignee_id: "me1",
    });
    await waitFor(() => expect(landed).toBe(assetPaths.maintenance.path()));
  });

  it("assigns to the person chosen instead", async () => {
    show(assetPaths.maintenanceNew.path());
    await fill();
    await userEvent.click(await screen.findByLabelText("Nagy Béla"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(1));
    expect(callsTo("taskmanager_repeating_task_create")[0][2]).toMatchObject({ assignee_kind: "actor", assignee_id: "p2" });
  });

  it("says the hub's refusal in words and stays on the screen", async () => {
    refusal = "tool error: an assignee must be an owner or an agent of this agency";
    show(assetPaths.maintenanceNew.path());
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/must be an owner or an agent/)).toBeInTheDocument();
    expect(landed).toBe(assetPaths.maintenanceNew.path());
  });

  it("keeps Save off until the weekday is chosen", async () => {
    show(assetPaths.maintenanceNew.path());
    await userEvent.type(await screen.findByLabelText("Title"), "Grease the gates");
    await userEvent.click(await screen.findByLabelText("Every week"));
    await userEvent.type(screen.getByLabelText("Starting on"), "2026-12-07");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Choose a weekday")).toBeInTheDocument();
    expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(0);
  });
});
