import { vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, backlogEntry, everyFact, filesEntry, forgetLanded, landed, menuEntry, needsYouWords, ongoingEntry, recordEntry, rowTitles, rowsBelowStrip, section, settle, showHome, showSection, startEntry, workflowEntry, rolesTool, type HomeNode, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 3, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const anchor = recordEntry("anchor", "Always here", "RC-1");

const homeShows = async (nodes: HomeNode[], over: Setup = {}) => {
  const shown = showHome({ ...everyFact, records: [{ code: "RC-1", name: "Anchor", canAdd: true }], ...over, nodes: [anchor, ...nodes] });
  await screen.findByText(needsYouWords(3));
  await waitFor(() => expect(rowsBelowStrip(shown.container)).toContain("Always here"));
  await settle();
  return rowsBelowStrip(shown.container).filter((title) => title !== "Always here");
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

describe("a node with a permission", () => {
  const gated = (permission: string) => backlogEntry("gated", "Gated", "b1", { permission });

  it("is hidden from a person who lacks it", async () => {
    expect(await homeShows([gated("farm.read")], { permissions: ["task.read"] })).toEqual([]);
  });

  it("is shown to a person who holds it", async () => {
    expect(await homeShows([gated("farm.read")], { permissions: ["task.read", "farm.read"] })).toEqual(["Gated"]);
  });

  it("is shown to anyone when it names none", async () => {
    expect(await homeShows([backlogEntry("open", "Open", "b1")], { permissions: ["task.read"] })).toEqual(["Open"]);
  });

  it("hides a whole section, with everything in it, when the section's permission is missing", async () => {
    const nodes = [section("closed", "Closed", [filesEntry()], { permission: "farm.admin" })];
    expect(await homeShows(nodes, { permissions: ["task.read"] })).toEqual([]);
  });

  it("hides the entry but keeps the section when another node of it is shown", async () => {
    const nodes = [section("mixed", "Mixed", [backlogEntry("a", "Needs admin", "b1", { permission: "farm.admin" }), filesEntry("f", "Open files")])];
    expect(await homeShows(nodes)).toEqual(["Mixed"]);
    cleanup();
    const { container } = showSection("mixed", { ...everyFact, nodes });
    await waitFor(() => expect(rowTitles(container)).toEqual(["Open files"]));
  });
});

describe("a section", () => {
  it("is hidden when every entry in it is hidden", async () => {
    const nodes = [section("empty", "Empty", [backlogEntry("a", "A", "b1", { permission: "x" }), backlogEntry("b", "B", "b1", { permission: "y" })])];
    expect(await homeShows(nodes)).toEqual([]);
  });

  it("is hidden when it holds only hidden sections, at any depth", async () => {
    const nodes = [section("l1", "Level one", [section("l2", "Level two", [section("l3", "Level three", [backlogEntry("a", "A", "b1", { permission: "x" })])])])];
    expect(await homeShows(nodes)).toEqual([]);
  });

  it("is hidden when it holds nothing at all", async () => {
    expect(await homeShows([section("none", "None", [])])).toEqual([]);
  });

  it("is shown when one node three levels down is shown, and so are the sections above it", async () => {
    const nodes = [section("l1", "Level one", [section("l2", "Level two", [section("l3", "Level three", [backlogEntry("a", "A", "b1", { permission: "x" }), filesEntry()])])])];
    expect(await homeShows(nodes)).toEqual(["Level one"]);
  });

  it("is left out of its parent's page when hidden, and the parent keeps its shown rows in order", async () => {
    const nodes = [section("top", "Top", [filesEntry("f1", "First"), section("gone", "Gone", [backlogEntry("a", "A", "b1", { permission: "x" })]), filesEntry("f2", "Second")])];
    const { container } = showSection("top", { ...everyFact, nodes });
    await waitFor(() => expect(rowTitles(container)).toEqual(["First", "Second"]));
  });

  it("goes to Home on a deep link to a hidden section", async () => {
    const nodes = [section("gone", "Gone", [backlogEntry("a", "A", "b1", { permission: "x" })])];
    showSection("gone", { ...everyFact, nodes });
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });
});

describe("an entry whose target is not shown", () => {
  it("is hidden for a workflow whose first step the person does not hold", async () => {
    const node = workflowEntry("visit", "Record a visit", "W-2", "Record a visit");
    expect(await homeShows([node], { openWorkflows: ["Another workflow"] })).toEqual([]);
  });

  it("is shown for a workflow whose first step the person holds", async () => {
    const node = workflowEntry("visit", "Record a visit", "W-2", "Record a visit");
    expect(await homeShows([node], { openWorkflows: ["Another workflow", "Record a visit"] })).toEqual(["Record a visit"]);
  });

  it("is hidden for a workflow when the person holds no start step at all", async () => {
    expect(await homeShows([workflowEntry("visit", "Record a visit", "W-2", "Record a visit")], { openWorkflows: [] })).toEqual([]);
  });

  it("is hidden for a backlog the person does not see", async () => {
    expect(await homeShows([backlogEntry("work", "Work", "b9")], { backlogs: [{ id: "b1", name: "Work" }] })).toEqual([]);
  });

  it("is shown for a backlog the person sees", async () => {
    expect(await homeShows([backlogEntry("work", "Work", "b1")], { backlogs: [{ id: "b1", name: "Work" }] })).toEqual(["Work"]);
  });

  it("is hidden for a backlog when the taskmanager module is off", async () => {
    expect(await homeShows([backlogEntry("work", "Work", "b1")], { modules: ["actor"] })).toEqual([]);
  });

  it("is hidden for a backlog when the person may not read backlogs", async () => {
    expect(await homeShows([backlogEntry("work", "Work", "b1")], { permissions: ["resident.read"] })).toEqual([]);
  });

  it("is hidden for Files when Files is not mounted", async () => {
    expect(await homeShows([filesEntry()], { files: false })).toEqual([]);
  });

  it("is shown for Files when Files is mounted", async () => {
    expect(await homeShows([filesEntry()], { files: true })).toEqual(["Files"]);
  });

  it("is hidden for a menu item whose module is off", async () => {
    expect(await homeShows([menuEntry("biz", "Businesses", "residents/Businesses")], { modules: ["taskmanager"] })).toEqual([]);
  });

  it("is shown for a menu item whose module is on", async () => {
    expect(await homeShows([menuEntry("biz", "Businesses", "residents/Businesses")], { modules: ["taskmanager", "actor"] })).toEqual(["Businesses"]);
  });

  it("is hidden for a menu item whose needs permission the person lacks", async () => {
    expect(await homeShows([menuEntry("search", "Search people", "residents/Search")], { permissions: [] })).toEqual([]);
  });

  it("is shown for a menu item whose needs permission the person holds", async () => {
    expect(await homeShows([menuEntry("search", "Search people", "residents/Search")], { permissions: ["resident.read"] })).toEqual(["Search people"]);
  });

  it("is hidden for a menu item that does not exist", async () => {
    expect(await homeShows([menuEntry("ghost", "Ghost", "residents/No such item")])).toEqual([]);
    expect(screen.queryByText("Not available yet")).not.toBeInTheDocument();
  });

  it("hides the section left with nothing, and keeps the section that still has a shown entry", async () => {
    const nodes = [
      section("dead", "Dead end", [filesEntry(), backlogEntry("w", "Work", "b9")]),
      section("alive", "Alive", [backlogEntry("w2", "Work", "b1"), filesEntry("f2", "More files")]),
    ];
    expect(await homeShows(nodes, { files: false, backlogs: [{ id: "b1", name: "Work" }] })).toEqual(["Alive"]);
  });
});

describe("a node with roles", () => {
  const forRoles = (...roles: string[]) => backlogEntry("work", "Work", "b1", { roles });

  it("is shown to a person who holds one of its roles", async () => {
    expect(await homeShows([forRoles("R-3", "R-4")], { roles: ["R-4"] })).toEqual(["Work"]);
  });

  it("is hidden from a person who holds none of its roles", async () => {
    expect(await homeShows([forRoles("R-3", "R-4")], { roles: ["R-9"] })).toEqual([]);
  });

  it("is hidden from a person who holds no agency role at all, who sees only nodes with neither roles nor permission", async () => {
    const nodes = [forRoles("R-3"), backlogEntry("open", "Open", "b1")];
    expect(await homeShows(nodes, { roles: [] })).toEqual(["Open"]);
  });

  it("is always shown to the owner, who holds no listed role", async () => {
    expect(await homeShows([forRoles("R-3")], { membership: "owner", roles: [] })).toEqual(["Work"]);
  });

  it("hides the whole section, with everything in it, from a person who holds none of the section's roles", async () => {
    const nodes = [section("closed", "Closed", [filesEntry()], { roles: ["R-3"] })];
    expect(await homeShows(nodes, { roles: ["R-9"] })).toEqual([]);
  });

  it("needs both the permission and a role when a node names both", async () => {
    const node = backlogEntry("both", "Both", "b1", { roles: ["R-3"], permission: "accounting.view" });
    expect(await homeShows([node], { roles: ["R-3"], permissions: ["task.read"] })).toEqual([]);
    cleanup();
    expect(await homeShows([node], { roles: ["R-9"], permissions: ["task.read", "accounting.view"] })).toEqual([]);
    cleanup();
    expect(await homeShows([node], { roles: ["R-3"], permissions: ["task.read", "accounting.view"] })).toEqual(["Both"]);
  });

  it("shows a resident the nodes their roles allow, on the same rule", async () => {
    const nodes = [forRoles("R-3"), backlogEntry("open", "Open", "b1")];
    expect(await homeShows(nodes, { membership: "resident", roles: ["R-3"] })).toEqual(["Work", "Open"]);
  });
});

describe("the Start and Ongoing entries", () => {
  it.each([
    ["Start", startEntry("my-work", "My work")],
    ["Ongoing", ongoingEntry("under-way", "Under way")],
  ])("never draws the %s entry, whatever the person holds, because My work is a tab of the bar", async (_name, node) => {
    expect(await homeShows([node], { openWorkflows: ["Record a visit"], availableWorkflows: ["Record a visit"] })).toEqual([]);
  });

  it.each([
    ["Start", startEntry("my-work", "My work")],
    ["Ongoing", ongoingEntry("under-way", "Under way")],
  ])("never draws the %s entry for a person who holds no workflow either", async (_name, node) => {
    expect(await homeShows([node], { openWorkflows: [], availableWorkflows: [] })).toEqual([]);
  });
});

describe("a backlog entry's ref", () => {
  it("may be the backlog's name", async () => {
    expect(await homeShows([backlogEntry("work", "Our work", "Work")], { backlogs: [{ id: "b1", name: "Work" }] })).toEqual(["Our work"]);
  });

  it("opens the issue list of the backlog the name stands for", async () => {
    const user = userEvent.setup();
    const shown = showHome({ ...everyFact, nodes: [backlogEntry("work", "Our work", "Work")], backlogs: [{ id: "b1", name: "Work" }] });
    await waitFor(() => expect(rowsBelowStrip(shown.container)).toEqual(["Our work"]));
    await user.click(screen.getByRole("button", { name: "Our work" }));
    expect(landed).toBe("/a/alego/backlogs/b1");
  });
});

describe("the reads Home decides from", () => {
  const gatedNodes = [backlogEntry("a", "A", "b1", { permission: "task.read" }), filesEntry("f", "F", { roles: ["R-3"] }), section("s", "S", [backlogEntry("b", "B", "b1", { permission: "resident.read" })], { roles: ["R-3"] })];

  it("reads the person's permissions and roles once for the whole Home, however many nodes are gated", async () => {
    const shown = showHome({ ...everyFact, roles: ["R-3"], nodes: gatedNodes });
    await waitFor(() => expect(rowsBelowStrip(shown.container)).toEqual(["A", "F", "S"]));
    await settle();
    expect(shown.hub.mock.calls.filter(([, tool]) => tool === rolesTool)).toHaveLength(1);
  });

  it("fails closed when the roles read fails: no gated node is drawn, and a failure line offers Try again", async () => {
    const shown = showHome({ ...everyFact, roles: ["R-3"], nodes: [...gatedNodes, filesEntry("open", "Open files")], down: { roles: true } });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    await settle();
    ["A", "F", "S"].forEach((title) => expect(rowsBelowStrip(shown.container)).not.toContain(title));
  });

  it("draws the gated nodes after Try again when the roles read then succeeds", async () => {
    const user = userEvent.setup();
    const outage = { roles: true };
    const shown = showHome({ ...everyFact, roles: ["R-3"], nodes: gatedNodes, down: outage });
    const retry = await screen.findByRole("button", { name: "Try again" });
    outage.roles = false;
    await user.click(retry);
    await waitFor(() => expect(rowsBelowStrip(shown.container)).toEqual(["A", "F", "S"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a failure line with Try again when the Files read fails, and draws the Files entry after it succeeds", async () => {
    const user = userEvent.setup();
    const outage = { files: true };
    const shown = showHome({ ...everyFact, nodes: [filesEntry()], down: outage });
    const retry = await screen.findByRole("button", { name: "Try again" });
    outage.files = false;
    await user.click(retry);
    await waitFor(() => expect(rowsBelowStrip(shown.container)).toEqual(["Files"]));
  });
});
