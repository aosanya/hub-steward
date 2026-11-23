import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, forgetLanded, forgetWide, hubOf, recordEntry, section, sectionPathOf, setWide, showAt, sectionRoute, SectionScreen, wiringOf, type RecordFact } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const tenders: RecordFact = { code: "RC-1", name: "Tenders", canAdd: true, questions: ["Title"], rows: [] };

const nodes = [section("win-work", "Win work", [recordEntry("tenders", "Tenders", "RC-1")])];

const addTender = { id: "gen-add-tender", record: "RC-1", action: "add" as const, name: "Add a tender" };

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
  setWide(true);
});

afterEach(() => {
  cleanup();
  forgetWide();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a section that holds only records", () => {
  it("lists the Add workflow under the Workflows heading, though no workflow entry is declared", async () => {
    showAt(sectionPathOf(agencyId, "win-work"), { nodes, records: [tenders], rowSteps: [addTender] });
    const tree = await screen.findByRole("tree");
    await waitFor(() => expect(within(tree).getByRole("treeitem", { name: "Add a tender" })).toBeInTheDocument());
    expect(within(tree).getByText("Workflows")).toBeInTheDocument();
  });

  it("has no Workflows heading when the person holds no Add step", async () => {
    showAt(sectionPathOf(agencyId, "win-work"), { nodes, records: [tenders], rowSteps: [] });
    const tree = await screen.findByRole("tree");
    await waitFor(() => expect(within(tree).getByRole("treeitem", { name: "Tenders" })).toBeInTheDocument());
    expect(within(tree).queryByText("Workflows")).not.toBeInTheDocument();
  });

  it("still shows the section when the steps cannot be read", async () => {
    const setup = { nodes, records: [tenders] };
    hubOf(setup);
    const wiring = { ...wiringOf(setup), steps: { available: async () => Promise.reject(new Error("down")) } };
    render(
      <MemoryRouter initialEntries={[sectionPathOf(agencyId, "win-work")]}>
        <Routes>
          <Route path={sectionRoute} element={<SectionScreen {...(wiring as object)} />} />
        </Routes>
      </MemoryRouter>,
    );
    const tree = await screen.findByRole("tree");
    expect(within(tree).getByRole("treeitem", { name: "Tenders" })).toBeInTheDocument();
    expect(within(tree).queryByText("Workflows")).not.toBeInTheDocument();
  });

  it("keeps the Add step of an owner or other holder away from a record the section does not show", async () => {
    showAt(sectionPathOf(agencyId, "win-work"), { nodes, records: [tenders], rowSteps: [{ ...addTender, id: "other", record: "RC-9", name: "Add a client" }] });
    const tree = await screen.findByRole("tree");
    await waitFor(() => expect(within(tree).getByRole("treeitem", { name: "Tenders" })).toBeInTheDocument());
    expect(within(tree).queryByRole("treeitem", { name: "Add a client" })).not.toBeInTheDocument();
  });
});
