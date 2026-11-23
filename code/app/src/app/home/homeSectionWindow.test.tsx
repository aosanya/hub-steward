import { vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, forgetLanded, forgetWide, landed, landedSearch, recordPathOf, sectionPathOf, setWide, showAt, useLanguageCode } from "./agencyHome_contract_adapters";
import { fieldSetup, manyPlots, seeds, visits } from "./agencyHome_contract_fieldwork";
import { magyar } from "../../shared/language/magyar";
import { swahili } from "../../shared/language/swahili";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const tree = () => screen.getByRole("tree");

const treeNames = () => within(tree()).getAllByRole("treeitem").map((item) => item.getAttribute("aria-label"));

const rightPane = () => screen.getByRole("region", { name: "Plots" });

const openSection = async (over = {}) => {
  showAt(sectionPathOf(agencyId, "field-work"), fieldSetup(over));
  await screen.findByRole("tree");
  await waitFor(() => expect(treeNames()).toContain("Report a pest"));
};

const openPlots = async (over = {}) => {
  showAt(recordPathOf(agencyId, "plots", "RC-1"), fieldSetup(over));
  await screen.findByRole("columnheader", { name: "Plot name" });
};

const pickHilltop = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByText("Hilltop"));
  await screen.findByText("For this plot");
  return user;
};

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

describe("a section on a wide screen: the left pane", () => {
  it("lists the section's entry names only, then the Workflows heading with the workflows not tied to a record", async () => {
    await openSection();
    expect(treeNames()).toEqual(["Plots", "Seed store", "Field files", "Report a pest"]);
    expect(within(tree()).getByText("Workflows")).toBeInTheDocument();
    const heading = within(tree()).getByText("Workflows");
    const pest = within(tree()).getByRole("treeitem", { name: "Report a pest" });
    expect(heading.compareDocumentPosition(pest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const files = within(tree()).getByRole("treeitem", { name: "Field files" });
    expect(files.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps a workflow tied to a record of the section out of the Workflows heading", async () => {
    await openSection();
    expect(within(tree()).queryByText("Check the boundary")).not.toBeInTheDocument();
  });

  it("holds no row of any record, and no row page", async () => {
    await openSection();
    expect(within(tree()).queryByText("Hilltop")).not.toBeInTheDocument();
    expect(within(tree()).queryByText("Plot")).not.toBeInTheDocument();
  });

  it("shows a nested section collapsed, and expands it in place to its own entries", async () => {
    const user = userEvent.setup();
    await openSection();
    expect(within(tree()).queryByRole("treeitem", { name: "Seeds" })).not.toBeInTheDocument();
    await user.click(within(tree()).getByRole("button", { name: "Expand Seed store" }));
    expect(treeNames()).toEqual(["Plots", "Seed store", "Seeds", "Field files", "Report a pest"]);
    const levels = within(tree()).getAllByRole("treeitem").map((item) => item.getAttribute("aria-level"));
    expect(levels).toEqual(["1", "1", "2", "1", "1"]);
    await user.click(within(tree()).getByRole("button", { name: "Collapse Seed store" }));
    expect(treeNames()).toEqual(["Plots", "Seed store", "Field files", "Report a pest"]);
  });

  it("keeps a nested section's tied workflow out of its entries too", async () => {
    const user = userEvent.setup();
    await openSection();
    await user.click(within(tree()).getByRole("button", { name: "Expand Seed store" }));
    expect(within(tree()).queryByText("Order seed")).not.toBeInTheDocument();
  });

  it("opens a record in the right pane under its own route when its name is picked", async () => {
    const user = userEvent.setup();
    await openSection();
    await user.click(within(tree()).getByRole("treeitem", { name: "Plots" }));
    expect(landed).toBe(recordPathOf(agencyId, "plots", "RC-1"));
  });

  it("reads Home on Back and goes to Home", async () => {
    const user = userEvent.setup();
    await openSection();
    await user.click(screen.getByRole("button", { name: "‹ Home" }));
    expect(landed).toBe("/a/alego/home");
  });

  it("expands to a nested section named in the route, and goes back to Home from it", async () => {
    const user = userEvent.setup();
    showAt(sectionPathOf(agencyId, "seed-store"), fieldSetup());
    await screen.findByRole("treeitem", { name: "Seeds" });
    expect(treeNames()).toEqual(["Plots", "Seed store", "Seeds", "Field files", "Report a pest"]);
    await user.click(screen.getByRole("button", { name: "‹ Home" }));
    expect(landed).toBe("/a/alego/home");
  });

  it("says the Workflows heading in the person's language", async () => {
    useLanguageCode("sw");
    await openSection();
    expect(within(tree()).getByText(swahili.homeWorkflows)).toBeInTheDocument();
    cleanup();
    useLanguageCode("hu");
    await openSection();
    expect(within(tree()).getByText(magyar.homeWorkflows)).toBeInTheDocument();
  });
});

describe("a record on a wide screen: the right pane", () => {
  it("shows the section's tree beside the record's rows as a table with the first three questions as columns", async () => {
    await openPlots();
    expect(treeNames()).toEqual(["Plots", "Seed store", "Field files", "Report a pest"]);
    expect(screen.getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Plot name", "Crop", "Village"]);
    expect(within(rightPane()).getByRole("cell", { name: "Hilltop" })).toBeInTheDocument();
    expect(within(rightPane()).getByRole("cell", { name: "Rice" })).toBeInTheDocument();
  });

  it("marks the open record in the tree", async () => {
    await openPlots();
    expect(within(tree()).getByRole("treeitem", { name: "Plots" })).toHaveAttribute("aria-selected", "true");
  });

  it("offers Add in the title row, and Add opens the new-row screen under the same route", async () => {
    const user = userEvent.setup();
    await openPlots();
    await user.click(within(rightPane()).getByRole("button", { name: "Add" }));
    expect(landed).toBe(`${recordPathOf(agencyId, "plots", "RC-1")}/new`);
  });

  it("offers no Add to a person who may not add rows", async () => {
    showAt(recordPathOf(agencyId, "seeds", "RC-2"), fieldSetup());
    await screen.findByRole("columnheader", { name: "Seed" });
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("keeps the Workflows heading in the tree however many rows the record has", async () => {
    await openPlots({ records: [manyPlots(60), seeds, visits] });
    await screen.findByRole("cell", { name: "Plot 60" });
    expect(within(rightPane()).getAllByRole("row")).toHaveLength(61);
    expect(treeNames()).toEqual(["Plots", "Seed store", "Field files", "Report a pest"]);
    expect(within(tree()).getByText("Workflows")).toBeInTheDocument();
  });

  it("goes back to Home from a record, the tree having shown the whole section", async () => {
    const user = userEvent.setup();
    await openPlots();
    await user.click(screen.getByRole("button", { name: "‹ Home" }));
    expect(landed).toBe("/a/alego/home");
  });

  it("opens a record of a nested section with that section expanded in the tree", async () => {
    showAt(recordPathOf(agencyId, "seeds", "RC-2"), fieldSetup());
    await screen.findByRole("columnheader", { name: "Seed" });
    expect(treeNames()).toEqual(["Plots", "Seed store", "Seeds", "Field files", "Report a pest"]);
    expect(within(tree()).getByRole("treeitem", { name: "Seeds" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("a picked row on a wide screen", () => {
  it("shows its facts beside the table, every question with its answer", async () => {
    await openPlots();
    await pickHilltop();
    const detail = screen.getByRole("region", { name: "Hilltop" });
    expect(within(detail).getByText("Soil notes")).toBeInTheDocument();
    expect(within(detail).getByText("Red loam")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("cell", { name: "Lakeside" })).toBeInTheDocument();
  });

  it("marks the picked row in the table", async () => {
    await openPlots();
    await pickHilltop();
    expect(screen.getByRole("row", { name: /Hilltop/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("row", { name: /Lakeside/ })).not.toHaveAttribute("aria-selected", "true");
  });

  it("lists under For this plot the tied workflow first, then the entries of the record's row page", async () => {
    await openPlots();
    await pickHilltop();
    const detail = screen.getByRole("region", { name: "Hilltop" });
    const steps = within(detail).getAllByRole("button").map((button) => button.textContent?.replace("›", ""));
    expect(steps).toEqual(expect.arrayContaining(["Check the boundary", "Record a visit", "Visits to this plot"]));
    const order = ["Check the boundary", "Record a visit", "Visits to this plot"].map((name) => steps.findIndex((text) => text?.includes(name)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("offers Open the plot page, and the button opens the row's page", async () => {
    const user = await (async () => {
      await openPlots();
      return pickHilltop();
    })();
    await user.click(screen.getByRole("button", { name: "Open the plot page" }));
    expect(landed).toBe("/a/alego/home/plot-page/row/r1");
  });

  it("opens the item of this row's own run when a tied workflow step is opened", async () => {
    await openPlots();
    const user = await pickHilltop();
    await user.click(within(screen.getByRole("region", { name: "Hilltop" })).getByText("Check the boundary"));
    expect(landed).toBe("/a/alego/steps/s-care-o1");
    expect(landedSearch).toBe("?order=o1");
  });

  it("opens the other row's run for the other row", async () => {
    await openPlots();
    const user = userEvent.setup();
    await user.click(await screen.findByText("Lakeside"));
    await user.click(await within(await screen.findByRole("region", { name: "Lakeside" })).findByText("Check the boundary"));
    expect(landed).toBe("/a/alego/steps/s-care-o2");
    expect(landedSearch).toBe("?order=o2");
  });

  it("opens a page entry's workflow on this row's item too", async () => {
    await openPlots();
    const user = await pickHilltop();
    await user.click(within(screen.getByRole("region", { name: "Hilltop" })).getByText("Record a visit"));
    expect(landed).toBe("/a/alego/steps/s-visit-o1");
    expect(landedSearch).toBe("?order=o1");
  });

  it("opens a page entry's record narrowed to this row", async () => {
    await openPlots();
    const user = await pickHilltop();
    await user.click(within(screen.getByRole("region", { name: "Hilltop" })).getByText("Visits to this plot"));
    expect(landed).toBe(recordPathOf(agencyId, "plot-visits", "RC-3", "r1").split("?")[0]);
    expect(landedSearch).toBe("?row=r1");
  });

  it("offers no page button for a record with no row page, and no steps when none are tied", async () => {
    showAt(recordPathOf(agencyId, "seeds", "RC-2"), fieldSetup());
    const user = userEvent.setup();
    await user.click(await screen.findByText("Maize hybrid"));
    await screen.findByText("For this seed");
    expect(screen.queryByRole("button", { name: /^Open the/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Maize hybrid" })).getByText("Order seed")).toBeInTheDocument();
  });

  it("says For this and Open the page in the person's language", async () => {
    useLanguageCode("sw");
    await openPlots();
    const user = userEvent.setup();
    await user.click(await screen.findByText("Hilltop"));
    await screen.findByText(swahili.homeForThis.replace("{thing}", "plot"));
    expect(screen.getByRole("button", { name: swahili.homeOpenPage.replace("{thing}", "plot") })).toBeInTheDocument();
    cleanup();
    useLanguageCode("hu");
    await openPlots();
    await user.click(await screen.findByText("Hilltop"));
    await screen.findByText(magyar.homeForThis.replace("{thing}", "plot"));
    expect(screen.getByRole("button", { name: magyar.homeOpenPage.replace("{thing}", "plot") })).toBeInTheDocument();
  });
});
