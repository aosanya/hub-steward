import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { assetPaths, scheduleEditPath } from "./paths";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let stopRefusal = "";
let landed = "";

const schedule = {
  id: "s1",
  title: "Monthly street light check",
  description: "Walk the main street at dusk",
  schedule_rule: "FREQ=MONTHLY;BYMONTHDAY=1",
  schedule_start: "2026-11-01T00:00:00Z",
  schedule_zone: "Europe/Budapest",
  assignee_kind: "role",
  assignee_id: "lighting",
  next_due_at: "2026-12-01T00:00:00Z",
};

const answer = async (name: string, args: unknown) => {
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "taskmanager_repeating_task_read") return { item: schedule };
  if (name === "taskmanager_repeating_task_list") return { items: [schedule] };
  if (name === "taskmanager_repeating_task_create") return { id: "s2" };
  if (name === "taskmanager_repeating_task_stop") {
    if (stopRefusal) throw new mcp.McpError(`taskmanager_repeating_task_stop: ${stopRefusal}`);
    return {};
  }
  throw new Error(`${name}: unknown tool ${JSON.stringify(args)}`);
};

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  setWide(true);
  permissions = ["task.edit"];
  stopRefusal = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetWidth();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
      <Where />
    </MemoryRouter>,
  );

const openEdit = async () => {
  show(scheduleEditPath.path({ scheduleId: "s1" }));
  await screen.findByLabelText("Title");
};

describe("the schedule page", () => {
  it("reads the rule in words and shows no raw rule", async () => {
    show(assetPaths.maintenance.path({ item: "s1" }));

    expect((await screen.findAllByText("Every month on the 1st")).length).toBeGreaterThan(0);
    expect(screen.queryByText("FREQ=MONTHLY;BYMONTHDAY=1")).toBeNull();
  });

  it("offers Edit in the Schedule card footer only to someone with task.edit", async () => {
    show(assetPaths.maintenance.path({ item: "s1" }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
    cleanup();
    permissions = [];
    show(assetPaths.maintenance.path({ item: "s1" }));
    await screen.findAllByText("Every month on the 1st");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens the edit screen from Edit", async () => {
    show(assetPaths.maintenance.path({ item: "s1" }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await waitFor(() => expect(landed).toBe(scheduleEditPath.path({ scheduleId: "s1" })));
  });
});

describe("the edit screen for a schedule", () => {
  it("opens filled from the schedule", async () => {
    await openEdit();

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Monthly street light check");
    expect((screen.getByLabelText("Every month") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Day of the month") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Starting on") as HTMLInputElement).value).toBe("2026-11-01");
  });

  it("saves a new schedule first and stops the old one second, keeping title, description, zone and assignee", async () => {
    await openEdit();

    await userEvent.click(screen.getByLabelText("Every 2 weeks"));
    await userEvent.click(screen.getByLabelText("Wednesday"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("taskmanager_repeating_task_stop")).toHaveLength(1));
    expect(callsTo("taskmanager_repeating_task_create")[0][2]).toEqual({
      title: "Monthly street light check",
      description: "Walk the main street at dusk",
      assignee_kind: "role",
      assignee_id: "lighting",
      schedule: { start: "2026-11-01T00:00:00Z", zone: "Europe/Budapest", rule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=WE" },
    });
    expect(callsTo("taskmanager_repeating_task_stop")[0][2]).toEqual({ repeatingTaskID: "s1" });
    const order = called.mock.calls.map(([, tool]) => tool);
    expect(order.indexOf("taskmanager_repeating_task_create")).toBeLessThan(order.indexOf("taskmanager_repeating_task_stop"));
    await waitFor(() => expect(landed).toBe(assetPaths.maintenance.path()));
  });

  it("changes only the title and keeps the rule", async () => {
    await openEdit();

    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Monthly lamp check");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(1));
    const sent = callsTo("taskmanager_repeating_task_create")[0][2] as { title: string; schedule: { rule: string } };
    expect(sent.title).toBe("Monthly lamp check");
    expect(sent.schedule.rule).toBe("FREQ=MONTHLY;BYMONTHDAY=1");
  });

  it("shows the refusal and stays on the screen when the old schedule cannot be stopped", async () => {
    stopRefusal = "not allowed to stop it";
    await openEdit();

    await userEvent.click(screen.getByLabelText("Every 2 weeks"));
    await userEvent.click(screen.getByLabelText("Friday"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/the new schedule was saved but the old one is still running/i)).toBeTruthy();
    expect(landed).toBe(scheduleEditPath.path({ scheduleId: "s1" }));
  });

  it("goes back to the schedule on Cancel without calling anything", async () => {
    await openEdit();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(landed).toBe(assetPaths.maintenance.path()));
    expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(0);
    expect(callsTo("taskmanager_repeating_task_stop")).toHaveLength(0);
  });
});
