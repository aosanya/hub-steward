import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { mcpStepsClient } from "../../features/steps/api";
import { mcpStartClient } from "../../features/market";
import { agencyId, forgetLanded, hubOf, landed, landedSearch, rowPage, rowPagePathOf, rowPageRoute, RowPageScreen, section, Where, wiringOf, workflowEntry, type RecordFact, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const projects: RecordFact = {
  code: "RC-4",
  name: "Projects",
  canAdd: true,
  questions: ["Project title"],
  rows: [
    { id: "p1", answers: { "Project title": "Alpha" } },
    { id: "p2", answers: { "Project title": "Beta" } },
  ],
};

const pageEntry = (key: string, title: string, stepId: string) => workflowEntry(key, title, "W-7", "Project run", {}, { workflow_id: "w7", step_id: stepId, step: stepId, scope: "row.order" });

const setup: Setup = {
  nodes: [
    section("deliver", "Deliver work", [
      rowPage("project-page", "Project", "RC-4", [
        pageEntry("plan", "Plan the tasks", "plan-step"),
        pageEntry("progress", "Progress report", "progress-step"),
        pageEntry("donor", "Donor report", "donor-step"),
      ]),
    ]),
  ],
  records: [projects],
  modules: ["taskmanager"],
};

const projectStep = (id: string, title: string) => ({
  id,
  title,
  kind: "fill_form",
  workflow_id: "w7",
  workflow_name: "Project run",
  role_name: "Project Manager",
  form_name: title,
  subject_record: "RC-4",
  questions: [{ prompt: "Notes", answer_type: "free_text", required: true }],
});

const waitingOn = (id: string, title: string, rowId: string, orderId: string) => ({ ...projectStep(id, title), state: "waiting", order_id: orderId, row_id: rowId, record_code: "RC-4" });

const waitingAll = [
  waitingOn("plan-step", "Plan the tasks", "p1", "run-a"),
  waitingOn("progress-step", "Progress report", "p1", "run-a"),
  waitingOn("donor-step", "Donor report", "p1", "run-a"),
  waitingOn("progress-step", "Progress report", "p2", "run-b"),
];

const showProject = (rowId: string, available: object[]) => {
  const hub = hubOf(setup);
  const base = hub.getMockImplementation()!;
  hub.mockImplementation(async (agency, tool, args) => {
    if (tool === "agency_list_my_open_steps") return { items: available };
    return base(agency, tool, args);
  });
  const wiring = { ...wiringOf(setup), steps: mcpStepsClient, start: mcpStartClient };
  return render(
    <MemoryRouter initialEntries={[rowPagePathOf(agencyId, "project-page", rowId)]}>
      <Routes>
        <Route path={rowPageRoute} element={<RowPageScreen {...wiring} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a project page's entries for the steps of a workflow with a subject record", () => {
  it.each([
    ["Plan the tasks", "plan-step", "run-a"],
    ["Progress report", "progress-step", "run-a"],
    ["Donor report", "donor-step", "run-a"],
  ])("opens the %s step of this project's run, not the Start list", async (title, stepId, orderId) => {
    showProject("p1", waitingAll);

    await userEvent.setup().click(await screen.findByText(title));

    expect(landed).toBe(`/a/alego/steps/${stepId}`);
    expect(landedSearch).toBe(`?order=${orderId}`);
  });

  it("opens the run of the other project on the other project's page", async () => {
    showProject("p2", waitingAll);

    await userEvent.setup().click(await screen.findByText("Progress report"));

    expect(landed).toBe("/a/alego/steps/progress-step");
    expect(landedSearch).toBe("?order=run-b");
  });
});
