import { vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { magyar } from "../../shared/language/magyar";
import { swahili } from "../../shared/language/swahili";
import { agencyId, forgetLanded, forgetWide, landed, landedSearch, landedState, recordEntry, recordPathOf, rowPagePathOf, section, setWide, showAt, showRecord, useLanguageCode, type RecordFact, type RowStepFact } from "./agencyHome_contract_adapters";
import { fieldSetup, plotSteps } from "./agencyHome_contract_fieldwork";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const farm: RecordFact = {
  code: "RC-9",
  name: "Farms",
  canAdd: false,
  questions: ["Farm name", "Crop"],
  rows: [{ id: "r1", answers: { "Farm name": "Green Acres", Crop: "Maize" } }],
};

const farmSteps: RowStepFact[] = [
  { id: "farm-edit", record: "RC-9", action: "edit", name: "Edit a farm" },
  { id: "farm-delete", record: "RC-9", action: "delete", name: "Delete a farm" },
];

const nodes = () => [section("registers", "Registers", [recordEntry("farms", "Farms", "RC-9")])];

const farmRecord = (rowSteps: RowStepFact[]) => showRecord("RC-9", { nodes: nodes(), records: [farm], rowSteps }, "farms");

let wideNow = true;

const pickGreenAcres = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByText("Green Acres"));
  await waitFor(() => expect(screen.getAllByText("Crop")).toHaveLength(wideNow ? 2 : 1));
  return user;
};

const detail = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
  wideNow = true;
  setWide(true);
});

afterEach(() => {
  cleanup();
  forgetWide();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a picked row on a wide screen: Edit and Delete", () => {
  it("offers Edit and Delete as buttons in the row's panel", async () => {
    showAt(recordPathOf(agencyId, "plots", "RC-1"), fieldSetup());
    const user = userEvent.setup();
    await user.click(await screen.findByText("Hilltop"));
    const panel = await screen.findByRole("region", { name: "Hilltop" });
    expect(within(panel).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("starts the Edit workflow with the picked row, and comes back to the list on the replacing row", async () => {
    showAt(recordPathOf(agencyId, "plots", "RC-1"), fieldSetup());
    const user = userEvent.setup();
    await user.click(await screen.findByText("Hilltop"));
    await user.click(within(await screen.findByRole("region", { name: "Hilltop" })).getByRole("button", { name: "Edit" }));
    expect(landed).toBe("/a/alego/steps/gen-edit-plots");
    expect(landedSearch).toBe("?row=r1");
    expect(landedState).toEqual({ from: { path: recordPathOf(agencyId, "plots", "RC-1"), title: "Plots" }, landing: `${recordPathOf(agencyId, "plots", "RC-1")}?open={row}` });
  });

  it("starts the Delete workflow with the picked row, and comes back to the list", async () => {
    showAt(recordPathOf(agencyId, "plots", "RC-1"), fieldSetup());
    const user = userEvent.setup();
    await user.click(await screen.findByText("Hilltop"));
    await user.click(within(await screen.findByRole("region", { name: "Hilltop" })).getByRole("button", { name: "Delete" }));
    expect(landed).toBe("/a/alego/steps/gen-delete-plots");
    expect(landedSearch).toBe("?row=r1");
    expect(landedState).toEqual({ from: { path: recordPathOf(agencyId, "plots", "RC-1"), title: "Plots" }, landing: recordPathOf(agencyId, "plots", "RC-1") });
  });

  it("offers Edit to a person who holds the edit role and may not add rows", async () => {
    farmRecord(farmSteps);
    await pickGreenAcres();
    expect(within(detail("Green Acres")).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("offers only what the person holds: Delete without Edit when only the delete step is held", async () => {
    farmRecord(farmSteps.slice(1));
    await pickGreenAcres();
    expect(within(detail("Green Acres")).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(detail("Green Acres")).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("offers neither to a person who holds neither step", async () => {
    farmRecord([]);
    await pickGreenAcres();
    expect(within(detail("Green Acres")).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(detail("Green Acres")).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("hides an Edit that a designed workflow replaces", async () => {
    farmRecord([{ ...farmSteps[0], replacedBy: "W-5" }, farmSteps[1]]);
    await pickGreenAcres();
    expect(within(detail("Green Acres")).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(detail("Green Acres")).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("takes the steps of the record shown, not of another record", async () => {
    farmRecord([{ id: "other-edit", record: "RC-1", action: "edit", name: "Edit a plot" }]);
    await pickGreenAcres();
    expect(within(detail("Green Acres")).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("says Edit and Delete in the person's language", async () => {
    useLanguageCode("sw");
    farmRecord(farmSteps);
    await pickGreenAcres();
    expect(within(detail("Green Acres")).getByRole("button", { name: swahili.homeEdit })).toBeInTheDocument();
    expect(within(detail("Green Acres")).getByRole("button", { name: swahili.homeDelete })).toBeInTheDocument();
    cleanup();
    useLanguageCode("hu");
    farmRecord(farmSteps);
    await pickGreenAcres();
    expect(within(detail("Green Acres")).getByRole("button", { name: magyar.homeEdit })).toBeInTheDocument();
    expect(within(detail("Green Acres")).getByRole("button", { name: magyar.homeDelete })).toBeInTheDocument();
  });
});

describe("a row on a phone: Edit and Delete", () => {
  beforeEach(() => {
    wideNow = false;
    setWide(false);
  });

  it("offers Edit and Delete on the row's facts, and Edit starts the workflow with the row", async () => {
    farmRecord(farmSteps);
    const user = await pickGreenAcres();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(landed).toBe("/a/alego/steps/farm-edit");
    expect(landedSearch).toBe("?row=r1");
    expect(landedState).toEqual({ from: { path: recordPathOf(agencyId, "farms", "RC-9"), title: "Farms" }, landing: `${recordPathOf(agencyId, "farms", "RC-9")}?open={row}` });
  });

  it("starts Delete with the row, and has no old edit route", async () => {
    farmRecord(farmSteps);
    const user = await pickGreenAcres();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(landed).toBe("/a/alego/steps/farm-delete");
    expect(landedSearch).toBe("?row=r1");
    expect(landed).not.toMatch(/\/edit$/);
  });

  it("has no Add button on the list", async () => {
    farmRecord(farmSteps);
    await screen.findByText("Green Acres");
    expect(screen.queryByRole("button", { name: /^Add/ })).not.toBeInTheDocument();
  });

  it("has no Add button on an empty list either", async () => {
    showRecord("RC-9", { nodes: nodes(), records: [{ ...farm, rows: [], canAdd: true }], rowSteps: [{ id: "farm-add", record: "RC-9", action: "add", name: "Add a farm" }] }, "farms");
    await screen.findByText("Nothing here yet.");
    expect(screen.queryByRole("button", { name: /^Add/ })).not.toBeInTheDocument();
  });
});

describe("a row's own page: Edit and Delete", () => {
  it("offers both, and Edit comes back to the page of the replacing row", async () => {
    showAt(rowPagePathOf(agencyId, "plot-page", "r1"), fieldSetup());
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(landed).toBe("/a/alego/steps/gen-edit-plots");
    expect(landedSearch).toBe("?row=r1");
    expect(landedState).toEqual({ from: { path: rowPagePathOf(agencyId, "plot-page", "r1"), title: "Plot" }, landing: rowPagePathOf(agencyId, "plot-page", "{row}") });
  });

  it("comes back to the record's list after a Delete, the row's page being gone", async () => {
    showAt(rowPagePathOf(agencyId, "plot-page", "r1"), fieldSetup());
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(landed).toBe("/a/alego/steps/gen-delete-plots");
    expect(landedState).toEqual({ from: { path: rowPagePathOf(agencyId, "plot-page", "r1"), title: "Plot" }, landing: recordPathOf(agencyId, "plots", "RC-1") });
  });

  it("offers neither to a person who holds neither step", async () => {
    showAt(rowPagePathOf(agencyId, "plot-page", "r1"), fieldSetup({ rowSteps: [] }));
    await screen.findByText("Soil notes");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("keeps the same steps the list offers", () => {
    expect(plotSteps.map((step) => step.action)).toEqual(["add", "edit", "delete"]);
  });
});
