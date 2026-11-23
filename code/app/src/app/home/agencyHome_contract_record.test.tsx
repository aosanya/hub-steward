import { vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, filesEntry, forgetLanded, landed, landedSearch, liveRowsTool, recordEntry, recordPathOf, rowOf, rowPage, rowPagePathOf, rowTitles, section, settle, showAt, showRecord, showRowPage, workflowEntry, type HomeNode, type RecordFact, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const farms = (code: string, canAdd: boolean, over: Partial<RecordFact> = {}): RecordFact => ({
  code,
  name: "Farms",
  canAdd,
  questions: ["Farm name", "Crop", "Village", "Soil notes"],
  rows: [
    { id: "r1", answers: { "Farm name": "Green Acres", Crop: "Maize", Village: "Alego", "Soil notes": "Red loam" } },
    { id: "r2", answers: { "Farm name": "Lakeside", Crop: "Rice", Village: "Usonga", "Soil notes": "Clay" } },
  ],
  ...over,
});

const registers = (code: string, over: Partial<HomeNode> = {}) => [section("registers", "Registers", [recordEntry("farm-list", "All farms", code, over)])];

const open = async (record: RecordFact, extra: RecordFact[] = [], nodes: HomeNode[] = registers(record.code), entryKey = "farm-list") => {
  const shown = showRecord(record.code, { nodes, records: [record, ...extra] }, entryKey);
  await waitFor(() => expect(screen.queryAllByText(/./).length).toBeGreaterThan(0));
  return shown;
};

const addButton = () => screen.queryByRole("button", { name: /^Add/ });

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe.each(["RC-77", "RC-1", "RC-2", "RC-3"])("a record entry's list for the record %s", (code) => {
  it("lists the record's rows, the first question as the row's title and the next two as its meta line", async () => {
    const { container } = await open(farms(code, true));
    await screen.findByText("Green Acres");
    const first = rowOf(container, "Green Acres");
    expect(first.querySelector(".meta")?.textContent).toBe("Maize · Alego");
    expect(within(first).queryByText("Red loam")).not.toBeInTheDocument();
  });

  it("opens a row on its page, with every question on it, when no section is the page of the record", async () => {
    const user = userEvent.setup();
    await open(farms(code, true));
    await user.click(await screen.findByText("Green Acres"));
    await waitFor(() => expect(screen.getByText("Soil notes")).toBeInTheDocument());
    ["Farm name", "Crop", "Village", "Soil notes"].forEach((prompt) => expect(screen.getByText(prompt)).toBeInTheDocument());
    ["Maize", "Alego", "Red loam"].forEach((answer) => expect(screen.getAllByText(answer).length).toBeGreaterThan(0));
  });

  it("draws no Add button, whether or not the person may add rows", async () => {
    await open(farms(code, true));
    await screen.findByText("Green Acres");
    await settle();
    expect(addButton()).not.toBeInTheDocument();
    cleanup();
    await open(farms(code, false));
    await screen.findByText("Green Acres");
    await settle();
    expect(addButton()).not.toBeInTheDocument();
  });

  it("goes back to the section named in the route, with no navigation state, as on a refresh or a link", async () => {
    const user = userEvent.setup();
    await open(farms(code, true));
    await user.click(await screen.findByRole("button", { name: "‹ Registers" }));
    expect(landed).toBe("/a/alego/home/registers");
  });
});

describe("a declared record whose code is one of the municipality's three registers", () => {
  const stranger = (code: string, name: string, canAdd: boolean): RecordFact => ({ code, name, canAdd, questions: ["Name", "Kind"], rows: [{ id: `${code}-1`, answers: { Name: `${name} row`, Kind: "other" } }] });

  it.each([
    ["RC-1", "Businesses"],
    ["RC-2", "Informal traders"],
    ["RC-3", "Maintenance records"],
  ])("lists only the rows of %s, never the rows of the record called %s", async (code, otherName) => {
    const { container } = await open(farms(code, true), [stranger("RC-90", otherName, true)]);
    await screen.findByText("Green Acres");
    await settle();
    expect(rowTitles(container).sort()).toEqual(["Green Acres", "Lakeside"]);
  });

  it("asks the rows tool for the record code as written, not for another record's code", async () => {
    const shown = await open(farms("RC-1", true), [stranger("RC-90", "Businesses", true)]);
    await screen.findByText("Green Acres");
    const asked = shown.hub.mock.calls.filter(([, tool]) => tool === liveRowsTool).map(([, , args]) => (args as { record_code?: string }).record_code);
    expect(asked.length).toBeGreaterThan(0);
    asked.forEach((code) => expect(code).toBe("RC-1"));
  });
});

describe("the title of a row in a record's list", () => {
  it("is the first non-empty answer of the row", async () => {
    const record = farms("RC-77", true, { rows: [{ id: "r1", answers: { "Farm name": "", Crop: "Maize", Village: "Alego", "Soil notes": "Red loam" } }] });
    const { container } = await open(record);
    await waitFor(() => expect(rowTitles(container)).toEqual(["Maize"]));
  });

  it("names the record and the row's position when every answer is empty", async () => {
    const record = farms("RC-77", true, { rows: [{ id: "r1", answers: {} }, { id: "r2", answers: {} }] });
    const { container } = await open(record);
    await waitFor(() => expect(rowTitles(container)).toHaveLength(2));
    const titles = rowTitles(container);
    titles.forEach((title) => expect(title).toContain("Farms"));
    expect(titles[0]).not.toBe(titles[1]);
    expect(titles[0]).toContain("1");
    expect(titles[1]).toContain("2");
  });
});

describe("a record with no questions", () => {
  it("shows an empty list and no Add, though the person may add rows", async () => {
    const { container } = await open(farms("RC-77", true, { questions: [], rows: [] }));
    await settle();
    expect(rowTitles(container)).toEqual([]);
    expect(addButton()).not.toBeInTheDocument();
  });
});

describe("a record entry with a where", () => {
  it("lists only the rows that meet it", async () => {
    const nodes = registers("RC-77", {}).map((one) => ({ ...one, entries: [recordEntry("alego-farms", "Farms in Alego", "RC-77", {}, [{ question: "Village", operator: "is", value: "Alego" }])] }));
    const { container } = await open(farms("RC-77", true), [], nodes, "alego-farms");
    await waitFor(() => expect(rowTitles(container)).toEqual(["Green Acres"]));
  });

  it("asks the rows tool with the conditions as declared", async () => {
    const where = [{ question: "Village", operator: "is", value: "Alego" }];
    const nodes = registers("RC-77").map((one) => ({ ...one, entries: [recordEntry("alego-farms", "Farms in Alego", "RC-77", {}, where)] }));
    const shown = await open(farms("RC-77", true), [], nodes, "alego-farms");
    await screen.findByText("Green Acres");
    const asked = shown.hub.mock.calls.filter(([, tool]) => tool === liveRowsTool).map(([, , args]) => (args as { where?: unknown }).where);
    expect(asked).toContainEqual(where);
  });
});

const projects: RecordFact = {
  code: "RC-4",
  name: "Projects",
  canAdd: true,
  questions: ["Project title", "Client", "Status"],
  rows: [
    { id: "p1", order_id: "o1", answers: { "Project title": "Alpha", Client: "Kisumu County", Status: "Running" } },
    { id: "p2", order_id: "o2", answers: { "Project title": "Beta", Client: "Nairobi Water", Status: "Planned" } },
  ],
};

const days: RecordFact = {
  code: "RC-6",
  name: "Days worked",
  canAdd: true,
  questions: ["Day", "Project", "Hours"],
  rows: [
    { id: "d1", answers: { Day: "Monday", Project: "Alpha", Hours: "8" } },
    { id: "d2", answers: { Day: "Tuesday", Project: "Beta", Hours: "6" } },
    { id: "d3", answers: { Day: "Wednesday", Project: "Alpha", Hours: "7" } },
  ],
};

const deliver = (): HomeNode[] => [
  section("deliver", "Deliver work", [
    recordEntry("projects", "Projects", "RC-4"),
    rowPage("project-page", "Project", "RC-4", [
      recordEntry("days", "Days worked", "RC-6", {}, [{ question: "Project", operator: "is", value: { row: "Project title" } }]),
      workflowEntry("report", "Progress report", "W-7", "Progress report", {}, { step: "WI-48", scope: "row.order" }),
      section("more", "More", [filesEntry("project-files", "Project files")]),
    ]),
  ]),
];

const deliverSetup: Setup = { nodes: deliver(), records: [projects, days], openWorkflows: ["Progress report"], files: true, modules: ["taskmanager"] };

describe("a row page", () => {
  it("opens when a row of the record's list is tapped, under the list's route", async () => {
    const user = userEvent.setup();
    showAt(recordPathOf(agencyId, "projects", "RC-4"), deliverSetup);
    await user.click(await screen.findByText("Alpha"));
    expect(landed).toBe(rowPagePathOf(agencyId, "project-page", "p1"));
  });

  it("is not listed in its parent section", async () => {
    const shown = showAt("/a/alego/home/deliver", deliverSetup);
    await waitFor(() => expect(rowTitles(shown.container)).toEqual(["Projects"]));
  });

  it("starts with the row's own facts, every question with its answer, then the page's listed nodes in order", async () => {
    const { container } = showRowPage("p1", "project-page", deliverSetup);
    await screen.findByText("Kisumu County");
    ["Project title", "Client", "Status"].forEach((prompt) => expect(screen.getByText(prompt)).toBeInTheDocument());
    ["Alpha", "Running"].forEach((answer) => expect(screen.getAllByText(answer).length).toBeGreaterThan(0));
    expect(rowTitles(container)).toEqual(["Days worked", "Progress report", "More"]);
    const main = screen.getByRole("main");
    const facts = within(main).getByText("Kisumu County");
    const firstRow = within(main).getByText("Days worked");
    expect(facts.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws the facts of the tapped row, not of another", async () => {
    showRowPage("p2", "project-page", deliverSetup);
    await screen.findByText("Nairobi Water");
    expect(screen.queryByText("Kisumu County")).not.toBeInTheDocument();
  });

  it("goes back to the record's list in the same section", async () => {
    const user = userEvent.setup();
    showRowPage("p1", "project-page", deliverSetup);
    await screen.findByText("Kisumu County");
    await user.click(screen.getByRole("button", { name: /^‹/ }));
    expect(landed).toBe(recordPathOf(agencyId, "projects", "RC-4"));
  });

  it("opens a section inside it under the same prefix, and Back goes to the page", async () => {
    const user = userEvent.setup();
    const { container } = showRowPage("p1", "project-page", deliverSetup);
    await screen.findByText("Kisumu County");
    await user.click(rowOf(container, "More"));
    expect(landed).toBe(rowPagePathOf(agencyId, "more", "p1"));
    cleanup();
    const nested = showRowPage("p1", "more", deliverSetup);
    await waitFor(() => expect(rowTitles(nested.container)).toEqual(["Project files"]));
    await user.click(screen.getByRole("button", { name: /^‹/ }));
    expect(landed).toBe(rowPagePathOf(agencyId, "project-page", "p1"));
  });

  it("narrows a record entry's list to the tapped row, filling {row} with that row's answer", async () => {
    const user = userEvent.setup();
    const { container } = showRowPage("p1", "project-page", deliverSetup);
    await screen.findByText("Kisumu County");
    await user.click(rowOf(container, "Days worked"));
    expect(landed).toBe(recordPathOf(agencyId, "days", "RC-6"));
    expect(landedSearch).toBe("?row=p1");
  });

  it("lists only the other record's rows that name the tapped row", async () => {
    const shown = showAt(recordPathOf(agencyId, "days", "RC-6", "p1"), deliverSetup);
    await waitFor(() => expect(rowTitles(shown.container)).toEqual(["Monday", "Wednesday"]));
  });

  it("asks the rows tool with the tapped row's answer in place of the placeholder", async () => {
    const shown = showAt(recordPathOf(agencyId, "days", "RC-6", "p2"), deliverSetup);
    await waitFor(() => expect(rowTitles(shown.container)).toEqual(["Tuesday"]));
    const asked = shown.hub.mock.calls.filter(([, tool]) => tool === liveRowsTool).map(([, , args]) => (args as { where?: unknown }).where);
    expect(asked).toContainEqual([{ question: "Project", operator: "is", value: "Beta" }]);
  });

  it("draws an empty list, not a failure, when a placeholder names a prompt the record does not have", async () => {
    const nodes = deliver();
    const page = nodes[0].entries?.[1] as HomeNode;
    (page.entries as HomeNode[])[0] = recordEntry("days", "Days worked", "RC-6", {}, [{ question: "Project", operator: "is", value: { row: "No such prompt" } }]);
    const shown = showAt(recordPathOf(agencyId, "days", "RC-6", "p1"), { ...deliverSetup, nodes });
    await settle();
    expect(rowTitles(shown.container)).toEqual([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("a record entry's route", () => {
  const twoLists = (): HomeNode[] => [
    section("registers", "Registers", [
      recordEntry("all-farms", "All farms", "RC-77"),
      recordEntry("alego-farms", "Farms in Alego", "RC-77", {}, [{ question: "Village", operator: "is", value: "Alego" }]),
    ]),
  ];

  it("names the entry, so two entries on one record with different conditions are two lists", async () => {
    const first = showAt(recordPathOf(agencyId, "all-farms", "RC-77"), { nodes: twoLists(), records: [farms("RC-77", true)] });
    await waitFor(() => expect(rowTitles(first.container)).toEqual(["Green Acres", "Lakeside"]));
    cleanup();
    const second = showAt(recordPathOf(agencyId, "alego-farms", "RC-77"), { nodes: twoLists(), records: [farms("RC-77", true)] });
    await waitFor(() => expect(rowTitles(second.container)).toEqual(["Green Acres"]));
  });

  it("goes to Home for an entry key the declaration does not hold", async () => {
    showAt(recordPathOf(agencyId, "no-such-entry", "RC-77"), { nodes: twoLists(), records: [farms("RC-77", true)] });
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });

  it("goes to Home when the code in the route is not the entry's record", async () => {
    showAt(recordPathOf(agencyId, "all-farms", "RC-99"), { nodes: twoLists(), records: [farms("RC-77", true)] });
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });

  it("draws no Add button in a list scoped to a row", async () => {
    showAt(recordPathOf(agencyId, "days", "RC-6", "p1"), deliverSetup);
    await screen.findByText("Monday");
    expect(addButton()).not.toBeInTheDocument();
  });

  it("goes back to the row page when the query names the row", async () => {
    const user = userEvent.setup();
    showAt(recordPathOf(agencyId, "days", "RC-6", "p1"), deliverSetup);
    await screen.findByText("Monday");
    await user.click(screen.getByRole("button", { name: "‹ Project" }));
    expect(landed).toBe(rowPagePathOf(agencyId, "project-page", "p1"));
  });

  it("opens a row of the scoped list on the page of its record, when a section is that page", async () => {
    const user = userEvent.setup();
    const nodes = deliver();
    (nodes[0].entries as HomeNode[]).push(rowPage("day-page", "Day", "RC-6", []));
    showAt(recordPathOf(agencyId, "days", "RC-6", "p1"), { ...deliverSetup, nodes });
    await user.click(await screen.findByText("Monday"));
    expect(landed).toBe(rowPagePathOf(agencyId, "day-page", "d1"));
  });
});

describe("the route of a row page", () => {
  it("goes to Home for a row page key opened with no row", async () => {
    showAt("/a/alego/home/project-page", deliverSetup);
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });

  it("goes to Home for a key that is neither a page nor inside one", async () => {
    showAt(rowPagePathOf(agencyId, "deliver", "p1"), deliverSetup);
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });

  it("goes back to Home when no record entry of its record is shown", async () => {
    const user = userEvent.setup();
    const nodes = deliver();
    (nodes[0].entries as HomeNode[]).shift();
    showAt(rowPagePathOf(agencyId, "project-page", "p1"), { ...deliverSetup, nodes });
    await screen.findByText("Kisumu County");
    await user.click(screen.getByRole("button", { name: /^‹/ }));
    expect(landed).toBe("/a/alego/home");
  });
});
