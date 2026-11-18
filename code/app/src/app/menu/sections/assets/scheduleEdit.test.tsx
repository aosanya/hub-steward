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
let updateRefusal = "";
let landed = "";
let landedSearch = "";

const monthly = {
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

const weekly = { ...monthly, title: "Weekly litter collection", schedule_rule: "FREQ=WEEKLY;BYDAY=MO", schedule_start: "2026-11-16T07:00:00Z" };

let schedule: Record<string, string> = monthly;

const answer = async (name: string, args: unknown) => {
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "taskmanager_repeating_task_read") return { item: schedule };
  if (name === "taskmanager_repeating_task_list") return { items: [schedule] };
  if (name === "taskmanager_repeating_task_update") {
    if (updateRefusal) throw new mcp.McpError(`taskmanager_repeating_task_update: ${updateRefusal}`);
    return { id: "s1" };
  }
  throw new Error(`${name}: unknown tool ${JSON.stringify(args)}`);
};

const Where = () => {
  const here = useLocation();
  landed = here.pathname;
  landedSearch = here.search;
  return null;
};

beforeEach(() => {
  openAgency("town");
  setWide(true);
  permissions = ["task.edit"];
  updateRefusal = "";
  schedule = monthly;
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

  it("saves the change in place with one update, keeping title, description, zone, assignee and start", async () => {
    await openEdit();

    await userEvent.click(screen.getByLabelText("Every 2 weeks"));
    await userEvent.click(screen.getByLabelText("Wednesday"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(1));
    expect(callsTo("taskmanager_repeating_task_update")[0][2]).toEqual({
      repeatingTaskID: "s1",
      title: "Monthly street light check",
      description: "Walk the main street at dusk",
      assignee_kind: "role",
      assignee_id: "lighting",
      schedule: { start: "2026-11-01T00:00:00Z", zone: "Europe/Budapest", rule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=WE" },
    });
    expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(0);
    expect(callsTo("taskmanager_repeating_task_stop")).toHaveLength(0);
    await waitFor(() => expect(landed).toBe(assetPaths.maintenance.path()));
  });

  it("changes only the title and keeps the rule", async () => {
    await openEdit();

    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Monthly lamp check");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(1));
    const sent = callsTo("taskmanager_repeating_task_update")[0][2] as { title: string; schedule: { rule: string } };
    expect(sent.title).toBe("Monthly lamp check");
    expect(sent.schedule.rule).toBe("FREQ=MONTHLY;BYMONTHDAY=1");
  });

  it("shows the refusal in words and stays on the screen when the schedule was stopped meanwhile", async () => {
    updateRefusal = "a stopped repeating task cannot be changed; start a new one";
    await openEdit();

    await userEvent.click(screen.getByLabelText("Every 2 weeks"));
    await userEvent.click(screen.getByLabelText("Friday"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/cannot be changed/i)).toBeTruthy();
    expect(landed).toBe(scheduleEditPath.path({ scheduleId: "s1" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(1);
    expect(callsTo("taskmanager_repeating_task_create")).toHaveLength(0);
    expect(callsTo("taskmanager_repeating_task_stop")).toHaveLength(0);
  });

  it("goes back to the schedule on Cancel without calling anything", async () => {
    await openEdit();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(landed).toBe(assetPaths.maintenance.path()));
    expect(landedSearch).toContain("item=s1");
    expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(0);
  });
});

describe("the choice of how often", () => {
  it("shows only the day of the month for a monthly schedule", async () => {
    await openEdit();

    expect(screen.getByLabelText("Day of the month")).toBeTruthy();
    expect(screen.queryByLabelText("Wednesday")).toBeNull();
  });

  it("shows only the weekday for a weekly schedule and swaps the field when the choice changes", async () => {
    schedule = weekly;
    await openEdit();

    expect(screen.getByLabelText("Monday")).toBeTruthy();
    expect(screen.queryByLabelText("Day of the month")).toBeNull();

    await userEvent.click(screen.getByLabelText("Every month"));

    expect(screen.getByLabelText("Day of the month")).toBeTruthy();
    expect(screen.queryByLabelText("Monday")).toBeNull();
  });

  it("refuses a weekly schedule with no weekday and calls nothing", async () => {
    await openEdit();

    await userEvent.click(screen.getByLabelText("Every week"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Choose a weekday")).toBeTruthy();
    expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(0);
  });

  it("refuses a monthly schedule with no day of the month and calls nothing", async () => {
    schedule = weekly;
    await openEdit();

    await userEvent.click(screen.getByLabelText("Every month"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a day of the month from 1 to 31")).toBeTruthy();
    expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(0);
  });

  it.each(["0", "32", "-3"])("refuses the day of the month %s and calls nothing", async (day) => {
    await openEdit();

    const field = screen.getByLabelText("Day of the month");
    await userEvent.clear(field);
    await userEvent.type(field, day);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a day of the month from 1 to 31")).toBeTruthy();
    expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(0);
  });
});

describe("when the schedule starts", () => {
  it("keeps the time of day of the old start when the start day is changed", async () => {
    schedule = weekly;
    await openEdit();

    const start = screen.getByLabelText("Starting on");
    await userEvent.clear(start);
    await userEvent.type(start, "2026-12-07");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(1));
    const sent = callsTo("taskmanager_repeating_task_update")[0][2] as { schedule: { start: string } };
    expect(sent.schedule.start).toBe("2026-12-07T07:00:00Z");
  });

  it("keeps the start the schedule has when only the rule changes, whatever job it made last", async () => {
    schedule = { ...weekly, last_due_at: "2026-11-23T07:00:00Z", last_task_id: "j1", next_due_at: "2026-11-23T08:00:00+01:00" };
    await openEdit();

    await userEvent.click(screen.getByLabelText("Tuesday"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("taskmanager_repeating_task_update")).toHaveLength(1));
    const sent = callsTo("taskmanager_repeating_task_update")[0][2] as { schedule: { start: string; rule: string } };
    expect(sent.schedule.start).toBe("2026-11-16T07:00:00Z");
    expect(sent.schedule.rule).toBe("FREQ=WEEKLY;BYDAY=TU");
  });
});
