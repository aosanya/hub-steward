import { vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, recordPathOf, showRecord, forgetLanded, landed, landedSearch, landedState, recordEntry, rowPage, rowPagePathOf, section, showAt, type RecordFact, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const tenders: RecordFact = { code: "RC-1", name: "Tenders", canAdd: true, questions: ["Title"], rows: [{ id: "r1", order_id: "o1", answers: { Title: "Dam" } }] };

const pageNodes = [section("deliver", "Deliver work", [recordEntry("tenders", "Tenders", "RC-1"), rowPage("tender-page", "Tender", "RC-1", [])])];

const tenderPath = rowPagePathOf(agencyId, "tender-page", "r1");

const directorSetup: Setup = {
  nodes: pageNodes,
  records: [tenders],
  modules: ["taskmanager"],
  rowSteps: [
    { id: "tender-edit", record: "RC-1", action: "edit", name: "Edit a tender" },
    { id: "tender-delete", record: "RC-1", action: "delete", name: "Delete a tender" },
  ],
  subjectWorkflows: [
    { id: "go-no-go-step", name: "Go or no-go", record: "RC-1" },
    { id: "project-step", name: "Project from proposal to donor report", record: "RC-2" },
  ],
};

const scoutSetup: Setup = { ...directorSetup, rowSteps: [], subjectWorkflows: [] };

const workflowsSection = () => screen.queryByRole("region", { name: "Workflows" });

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a row page offers the workflows whose subject is its record", () => {
  it("shows the Practice Director a Workflows section that starts collapsed", async () => {
    showAt(tenderPath, directorSetup);
    const toggle = await within(await screen.findByRole("region", { name: "Workflows" })).findByRole("button", { name: "Expand" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Go or no-go")).not.toBeInTheDocument();
  });

  it("lists Go or no-go once the section is opened, and not a workflow of another record", async () => {
    showAt(tenderPath, directorSetup);
    const user = userEvent.setup();
    const region = await screen.findByRole("region", { name: "Workflows" });
    await user.click(within(region).getByRole("button", { name: "Expand" }));
    expect(within(region).getByText("Go or no-go")).toBeInTheDocument();
    expect(within(region).queryByText("Project from proposal to donor report")).not.toBeInTheDocument();
  });

  it("shows the Tender Scout no Workflows section", async () => {
    showAt(tenderPath, scoutSetup);
    await screen.findByRole("region", { name: "Tenders" });
    expect(workflowsSection()).not.toBeInTheDocument();
  });

  it("starts the workflow with the row and comes back to the row's page", async () => {
    showAt(tenderPath, directorSetup);
    const user = userEvent.setup();
    const region = await screen.findByRole("region", { name: "Workflows" });
    await user.click(within(region).getByRole("button", { name: "Expand" }));
    await user.click(within(region).getByText("Go or no-go"));
    expect(landed).toBe("/a/alego/steps/go-no-go-step");
    expect(landedSearch).toBe("?row=r1");
    expect(landedState).toEqual({ from: { path: tenderPath, title: "Tender" }, landing: rowPagePathOf(agencyId, "tender-page", "{row}") });
  });

  it("keeps Edit and Delete in the facts section, not in Workflows", async () => {
    showAt(tenderPath, directorSetup);
    const facts = await screen.findByRole("region", { name: "Tenders" });
    expect(within(facts).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(facts).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    const workflows = screen.getByRole("region", { name: "Workflows" });
    expect(within(workflows).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});

describe("a record's list offers the same Workflows section in a picked row's detail", () => {
  it("starts the workflow with the row and comes back to the list on the row", async () => {
    showRecord("RC-1", { ...directorSetup, nodes: [section("deliver", "Deliver work", [recordEntry("tenders", "Tenders", "RC-1")])] }, "tenders");
    const user = userEvent.setup();
    await user.click(await screen.findByText("Dam"));
    const region = await screen.findByRole("region", { name: "Workflows" });
    expect(within(region).queryByText("Go or no-go")).not.toBeInTheDocument();
    await user.click(within(region).getByRole("button", { name: "Expand" }));
    await user.click(within(region).getByText("Go or no-go"));
    expect(landed).toBe("/a/alego/steps/go-no-go-step");
    expect(landedSearch).toBe("?row=r1");
    expect(landedState).toEqual({ from: { path: recordPathOf(agencyId, "tenders", "RC-1"), title: "Tenders" }, landing: `${recordPathOf(agencyId, "tenders", "RC-1")}?open={row}` });
  });
});
