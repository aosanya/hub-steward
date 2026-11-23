import { vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, filesEntry, forgetLanded, forgetWide, recordEntry, recordPathOf, rowOf, rowPage, rowTitles, section, setWide, showAt, showRowPage, type RecordFact, type Setup } from "./agencyHome_contract_adapters";
import { fieldSetup } from "./agencyHome_contract_fieldwork";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const lead = "9d5847ba-208c-4e33-bc9b-e427cce350b8";

const projects: RecordFact = {
  code: "RC-4",
  name: "Projects",
  canAdd: true,
  questions: ["Project title", "Client", { prompt: "Project lead", answer_type: "single_choice", options_from: "members" }],
  rows: [{ id: "p1", answers: { "Project title": "Alpha", Client: "Kisumu County", "Project lead": lead } }],
};

const setup = (over: Setup = {}): Setup => ({
  nodes: [section("deliver", "Deliver work", [recordEntry("projects", "Projects", "RC-4"), rowPage("project-page", "Project", "RC-4", [filesEntry("project-files", "Project files")])])],
  records: [projects],
  files: true,
  people: [{ id: lead, display_name: "Corisande Whitlock" }],
  ...over,
});

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
  setWide(false);
});

afterEach(() => {
  cleanup();
  forgetWide();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("every row of a section or row page ends in a chevron", () => {
  it("ends the entries of a row page in ›", async () => {
    const { container } = showRowPage("p1", "project-page", setup());
    await waitFor(() => expect(rowTitles(container)).toEqual(["Project files"]));
    expect(rowOf(container, "Project files").querySelector(".end")?.textContent).toBe("›");
  });

  it("ends the workflow rows under the Workflows heading of a section in ›", async () => {
    const shown = showAt("/a/alego/home/field-work", fieldSetup());
    await screen.findByRole("heading", { level: 2, name: "Workflows" });
    const rows = Array.from(shown.container.querySelectorAll("button.row"));
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(row.querySelector(".end")?.textContent).toBe("›"));
  });
});

describe("the facts card header carries no count", () => {
  it("reads the record's name alone on a row page", async () => {
    const { container } = showRowPage("p1", "project-page", setup());
    await screen.findByText("Kisumu County");
    expect(container.querySelector(".sec-title")?.textContent).toBe("Projects");
  });

  it("reads the record's name alone above a picked row's facts on a wide screen", async () => {
    setWide(true);
    const user = userEvent.setup();
    showAt(recordPathOf(agencyId, "projects", "RC-4"), setup());
    await user.click(await screen.findByText("Alpha"));
    const facts = await screen.findAllByText("Kisumu County");
    const card = facts.at(-1)?.closest("section.sec") as HTMLElement;
    expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe("Projects");
  });
});

describe("a member-pick answer on a row's facts", () => {
  it("shows the person's name and never the account id", async () => {
    showRowPage("p1", "project-page", setup());
    expect(await screen.findByText("Corisande Whitlock")).toBeInTheDocument();
    expect(screen.queryByText(lead)).not.toBeInTheDocument();
  });

  it("shows Unnamed person, not the id, when no name can be found", async () => {
    showRowPage("p1", "project-page", setup({ people: [] }));
    await screen.findByText("Kisumu County");
    await waitFor(() => expect(screen.getByText("Unnamed person")).toBeInTheDocument());
    expect(screen.queryByText(lead)).not.toBeInTheDocument();
  });
});
