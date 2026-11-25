import { vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { uuidKey } from "../../shared/wakala/liveRecords.test-support";
import { agencyId, forgetLanded, landed, recordEntry, rowPage, rowPagePathOf, section, showRecord, showRowPage, type RecordFact, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const tenders: RecordFact = {
  key: uuidKey,
  code: "tender_register",
  name: "Tenders",
  canAdd: true,
  workflowId: "wf-tender",
  questions: ["Title", "Client", "Deadline"],
  rows: [
    { id: "r1", answers: { Title: "Dam", Client: "Water board", Deadline: "2027-03-01" } },
    { id: "r2", answers: { Title: "Road", Client: "County", Deadline: "2027-04-12" } },
  ],
};

const nodes = [section("deliver", "Deliver work", [recordEntry("tenders", "Tenders", uuidKey), rowPage("tender-page", "Tender", uuidKey, [])])];

const setup: Setup = {
  nodes,
  records: [tenders],
  modules: ["taskmanager"],
  rowSteps: [
    { id: "tender-edit", record: uuidKey, action: "edit", name: "Edit a tender" },
    { id: "tender-delete", record: uuidKey, action: "delete", name: "Delete a tender" },
  ],
  subjectWorkflows: [{ id: "go-no-go-step", name: "Go or no-go", record: uuidKey }],
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

describe("a home entry that names a record by its UUID key after the record's code was renamed", () => {
  it("lists the record's rows with the first question as the title and the next two as the meta line", async () => {
    const { container } = showRecord(uuidKey, setup, "tenders");

    const first = (await screen.findByText("Dam")).closest("button");
    expect(first?.querySelector(".meta")?.textContent).toBe("Water board · 2027-03-01");
    expect(container.querySelectorAll("button.row")).toHaveLength(2);
  });

  it("opens a row with every question under its prompt and the Edit and Delete acts of the record's steps", async () => {
    const user = userEvent.setup();
    showRecord(uuidKey, setup, "tenders");

    await user.click(await screen.findByText("Dam"));

    expect(await screen.findByText("Water board")).toBeInTheDocument();
    ["Title", "Client", "Deadline"].forEach((prompt) => expect(screen.getByText(prompt)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows a row page with its answers, its acts and the workflows whose subject is the record's key", async () => {
    const user = userEvent.setup();
    showRowPage("r1", "tender-page", setup);

    expect(await screen.findByText("Water board")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    const region = await screen.findByRole("region", { name: "Workflows" });
    await user.click(within(region).getByRole("button", { name: "Expand" }));
    expect(within(region).getByText("Go or no-go")).toBeInTheDocument();
    expect(landed).toBe(rowPagePathOf(agencyId, "tender-page", "r1"));
  });
});
