import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { mcpStepsClient } from "../../features/steps/api";
import { mcpStartClient } from "../../features/market";
import { agencyId, forgetLanded, forgetWide, hubOf, landed, landedSearch, recordEntry, rowPage, rowPagePathOf, rowPageRoute, RowPageScreen, section, sectionPathOf, sectionRoute, SectionScreen, setWide, Where, wiringOf, workflowEntry, type RecordFact, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const tenders: RecordFact = {
  code: "RC-1",
  name: "Tenders",
  canAdd: true,
  questions: ["Title"],
  rows: [
    { id: "r1", answers: { Title: "Dam" } },
    { id: "r2", answers: { Title: "Bridge" } },
  ],
};

const ofPipeline = (key: string, title: string, stepId: string, scope?: string) => workflowEntry(key, title, "W-1", "Bid pipeline", {}, { workflow_id: "w1", step_id: stepId, step: stepId, ...(scope ? { scope } : {}) });

const setup: Setup = {
  nodes: [
    section("sales", "Sales", [
      recordEntry("tenders", "Tenders", "RC-1"),
      ofPipeline("decide", "Decide to bid", "decide-step"),
      ofPipeline("sign", "Sign off the offer", "sign-step"),
      workflowEntry("visit", "Record a visit", "W-2", "Record a visit", {}, { workflow_id: "w2" }),
      rowPage("tender-page", "Tender", "RC-1", [ofPipeline("sign-row", "Sign this offer", "sign-step", "row.order")]),
    ]),
  ],
  records: [tenders],
  modules: ["taskmanager"],
};

const pipelineStep = (id: string, title: string) => ({
  id,
  title,
  kind: "fill_form",
  workflow_id: "w1",
  workflow_name: "Bid pipeline",
  role_name: "Lead",
  form_name: title,
  subject_record: "RC-1",
  questions: [{ prompt: "Decision", answer_type: "free_text", required: true }],
});

const decide = pipelineStep("decide-step", "Decide to bid");

const sign = pipelineStep("sign-step", "Sign off the offer");

const visit = { id: "visit-step", title: "Record a visit", kind: "fill_form", workflow_id: "w2", workflow_name: "Record a visit", role_name: "Lead", form_name: "Visit", questions: decide.questions };

const startable = [{ ...decide, state: "start" }, { ...visit, state: "start" }];

const waitingOnR1 = { ...sign, state: "waiting", order_id: "o1", row_id: "r1", record_code: "RC-1" };

const showAt = (path: string, available: object[]) => {
  const hub = hubOf(setup);
  const base = hub.getMockImplementation()!;
  hub.mockImplementation(async (agency, tool, args) => {
    if (tool === "agency_list_my_open_steps") return { items: (args as { available?: boolean } | undefined)?.available ? available : [decide, sign, visit] };
    return base(agency, tool, args);
  });
  const wiring = { ...wiringOf(setup), steps: mcpStepsClient, start: mcpStartClient };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={sectionRoute} element={<SectionScreen {...wiring} />} />
        <Route path={rowPageRoute} element={<RowPageScreen {...wiring} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
};

const showSales = (available: object[] = startable) => showAt(sectionPathOf(agencyId, "sales"), available);

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetWide();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe.each([
  ["on a phone", false],
  ["on a wide window", true],
])("a section's workflows of a workflow with a subject record, %s", (_, wide) => {
  it("lists no row for its steps while none waits, and keeps the other workflows", async () => {
    setWide(wide);
    showSales();

    expect(await screen.findByText("Record a visit")).toBeInTheDocument();
    expect(screen.queryByText("Decide to bid")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign off the offer")).not.toBeInTheDocument();
  });

  it("lists the step that waits on one row and opens that run", async () => {
    setWide(wide);
    showSales([...startable, waitingOnR1]);

    await userEvent.setup().click(await screen.findByText("Sign off the offer"));

    expect(screen.queryByText("Decide to bid")).not.toBeInTheDocument();
    expect(landed).toBe("/a/alego/steps/sign-step");
    expect(landedSearch).toBe("?order=o1");
  });
});

describe("a row page's own entry for a step of a workflow with a subject record", () => {
  it("opens the run that waits on this row, which carries no order of its own", async () => {
    showAt(rowPagePathOf(agencyId, "tender-page", "r1"), [...startable, waitingOnR1]);

    await userEvent.setup().click(await screen.findByText("Sign this offer"));

    expect(landed).toBe("/a/alego/steps/sign-step");
    expect(landedSearch).toBe("?order=o1");
  });

  it("never opens the run that waits on another row", async () => {
    showAt(rowPagePathOf(agencyId, "tender-page", "r2"), [...startable, waitingOnR1]);

    await userEvent.setup().click(await screen.findByText("Sign this offer"));

    expect(landed).not.toBe("/a/alego/steps/sign-step");
  });
});
