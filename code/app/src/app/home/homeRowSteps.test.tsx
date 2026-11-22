import { vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, forgetLanded, forgetWide, landed, landedSearch, recordPathOf, rowOf, rowPagePathOf, rowTitles, sectionPathOf, setWide, showAt } from "./agencyHome_contract_adapters";
import { fieldSetup } from "./agencyHome_contract_fieldwork";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

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

describe("a section on a phone", () => {
  it("lists its entries as rows, then the Workflows heading with the workflows not tied to a record", async () => {
    const shown = showAt(sectionPathOf(agencyId, "field-work"), fieldSetup());
    await waitFor(() => expect(rowTitles(shown.container)).toContain("Report a pest"));
    expect(rowTitles(shown.container)).toEqual(["Plots", "Seed store", "Field files", "Report a pest"]);
    const heading = within(screen.getByRole("main")).getByRole("heading", { name: "Workflows" });
    expect(heading.compareDocumentPosition(rowOf(shown.container, "Report a pest")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.compareDocumentPosition(rowOf(shown.container, "Field files")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("draws no Workflows heading when every workflow is tied to a record", async () => {
    const shown = showAt(sectionPathOf(agencyId, "seed-store"), fieldSetup());
    await waitFor(() => expect(rowTitles(shown.container)).toEqual(["Seeds"]));
    expect(screen.queryByRole("heading", { name: "Workflows" })).not.toBeInTheDocument();
  });

  it("has a labelled Back on every level, the nested section's reading the section above", async () => {
    const user = userEvent.setup();
    showAt(sectionPathOf(agencyId, "seed-store"), fieldSetup());
    await screen.findByText("Seeds");
    await user.click(screen.getByRole("button", { name: "‹ Field work" }));
    expect(landed).toBe("/a/alego/home/field-work");
  });
});

describe("a record's list on a phone", () => {
  it("opens a row on the row page of the record, with the row's facts", async () => {
    const user = userEvent.setup();
    showAt(recordPathOf(agencyId, "plots", "RC-1"), fieldSetup());
    await user.click(await screen.findByText("Hilltop"));
    expect(landed).toBe(rowPagePathOf(agencyId, "plot-page", "r1"));
  });

  it("opens a row with no page on its facts and its tied steps, Back reading the list", async () => {
    const user = userEvent.setup();
    showAt(recordPathOf(agencyId, "seeds", "RC-2"), fieldSetup());
    await user.click(await screen.findByText("Maize hybrid"));
    await screen.findByText("For this seed");
    expect(screen.getAllByText("Agro Ltd").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Order seed/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Seeds" }));
    expect(await screen.findByText("Maize hybrid")).toBeInTheDocument();
    expect(screen.queryByText("For this seed")).not.toBeInTheDocument();
  });
});

describe("a row page", () => {
  it("lists under For this plot the tied workflow first, then the page's own entries", async () => {
    const shown = showAt(rowPagePathOf(agencyId, "plot-page", "r1"), fieldSetup());
    await screen.findByText("For this plot");
    expect(rowTitles(shown.container)).toEqual(["Check the boundary", "Record a visit", "Visits to this plot"]);
  });

  it("opens a tied workflow on this row's own item", async () => {
    const user = userEvent.setup();
    const shown = showAt(rowPagePathOf(agencyId, "plot-page", "r2"), fieldSetup());
    await screen.findByText("For this plot");
    await user.click(rowOf(shown.container, "Check the boundary"));
    expect(landed).toBe("/a/alego/steps/s-care-o2");
    expect(landedSearch).toBe("?order=o2");
  });

  it("keeps a labelled Back to the record's list", async () => {
    const user = userEvent.setup();
    showAt(rowPagePathOf(agencyId, "plot-page", "r1"), fieldSetup());
    await screen.findByText("Soil notes");
    await user.click(screen.getByRole("button", { name: "‹ Plots" }));
    expect(landed).toBe(recordPathOf(agencyId, "plots", "RC-1"));
  });
});
