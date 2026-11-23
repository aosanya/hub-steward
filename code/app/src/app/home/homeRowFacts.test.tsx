import { vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, forgetLanded, landed, landedSearch, recordEntry, section, showRecord, type QuestionFact } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const questions: QuestionFact[] = [
  { prompt: "Farm name", answer_type: "free_text", required: true },
  { prompt: "Irrigated", answer_type: "yes_no", required: false },
  { prompt: "Gate photo", answer_type: "photo", required: false },
  { prompt: "Visit window", answer_type: "time_range", required: false },
  { prompt: "Notes", answer_type: "free_text", required: false },
];

const record = {
  code: "RC-9",
  name: "Farms",
  canAdd: true,
  questions,
  rows: [{ id: "r1", answers: { "Farm name": "Green Acres", Irrigated: "Yes", "Gate photo": "gate.png", "Visit window": "from 08:00 to 10:00" } }],
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

describe("a row's page when no section is the page of the record", () => {
  it("shows every question, the answer types the form cannot take as their stored text, and a dash for an empty answer", async () => {
    const user = userEvent.setup();
    showRecord("RC-9", { nodes: [section("registers", "Registers", [recordEntry("farms", "Farms", "RC-9")])], records: [record] }, "farms");
    await user.click(await screen.findByText("Green Acres"));
    await waitFor(() => expect(screen.getByText("Gate photo")).toBeInTheDocument());
    ["Farm name", "Irrigated", "Gate photo", "Visit window", "Notes"].forEach((prompt) => expect(screen.getByText(prompt)).toBeInTheDocument());
    ["Yes", "gate.png", "from 08:00 to 10:00", "—"].forEach((words) => expect(screen.getByText(words)).toBeInTheDocument());
  });

  it("offers Edit to a person who holds the edit step and starts that workflow with the row", async () => {
    const user = userEvent.setup();
    showRecord("RC-9", { nodes: [section("registers", "Registers", [recordEntry("farms", "Farms", "RC-9")])], records: [record], rowSteps: [{ id: "farm-edit", record: "RC-9", action: "edit", name: "Edit a farm" }] }, "farms");
    await user.click(await screen.findByText("Green Acres"));
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(landed).toBe("/a/alego/steps/farm-edit");
    expect(landedSearch).toBe("?row=r1");
  });

  it("offers no Edit to a person who holds no edit step, though she may add rows", async () => {
    const user = userEvent.setup();
    showRecord("RC-9", { nodes: [section("registers", "Registers", [recordEntry("farms", "Farms", "RC-9")])], records: [record], rowSteps: [{ id: "farm-add", record: "RC-9", action: "add", name: "Add a farm" }] }, "farms");
    await user.click(await screen.findByText("Green Acres"));
    await waitFor(() => expect(screen.getByText("Gate photo")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
