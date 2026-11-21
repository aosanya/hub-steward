import { vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { iconNames } from "../../shared/ui/Icon";
import { issuesPath } from "../../features/backlogs";
import { filesHomePath } from "../../features/files";
import { residentPaths } from "../menu/sections/residents/paths";
import { agencyId, backlogEntry, everyFact, filesEntry, forgetLanded, landed, menuEntry, needsYouWords, ongoingEntry, recordEntry, rowOf, rowPage, rowTitles, rowsBelowStrip, section, settle, showHome, startEntry, useLanguageCode, workflowEntry, emptyCardOf, type HomeNode, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 3, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const registers = section(
  "registers",
  "Registers",
  [
    section("farms", "Farms", [recordEntry("farm-list", "All farms", "RC-1"), workflowEntry("farm-visit", "Record a visit", "W-2", "Record a visit")]),
    filesEntry(),
  ],
  { icon: "folder", titles: { sw: "Rejista" } },
);

const work = backlogEntry("work", "Work", "b1", { permission: "task.read" });

const declared = (nodes: HomeNode[], over: Setup = {}): Setup => ({ ...everyFact, nodes, ...over });

const homeRows = async (setup: Setup) => {
  const shown = showHome(setup);
  await screen.findByText(needsYouWords(3));
  await waitFor(() => expect(rowsBelowStrip(shown.container).length).toBeGreaterThan(0));
  return shown;
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

describe("Home with a declaration", () => {
  it("is the Needs-you strip and then one row for each shown top-level node, in declared order", async () => {
    const { container } = await homeRows(declared([registers, work]));
    expect(rowTitles(container)).toEqual([needsYouWords(3), "Registers", "Work"]);
  });

  it("keeps the declared order among sections and entries alike, and sorts nothing", async () => {
    const nodes = [backlogEntry("z-work", "Zebra work", "b1"), section("a-sec", "Apples", [filesEntry()]), recordEntry("m-rec", "Melons", "RC-1"), section("b-sec", "Bananas", [filesEntry("f2", "More files")])];
    const { container } = await homeRows(declared(nodes, { records: [{ code: "RC-1", name: "Melons", canAdd: true }] }));
    expect(rowsBelowStrip(container)).toEqual(["Zebra work", "Apples", "Melons", "Bananas"]);
  });

  it.each(["Start", "Ongoing", "Backlogs", "Files", "People", "Places & Addresses", "Issues & Requests", "Services & Permits", "Assets & Works", "Decisions", "Staff & Departments", "Finance", "Settings"])(
    "draws no %s row of HomeOptions or MenuRows when the agency does not declare one, though its modules and roles would show it",
    async (title) => {
      const { container } = await homeRows(declared([registers, work]));
      expect(rowTitles(container)).not.toContain(title);
    },
  );

  it("shows Start, Ongoing, Backlogs and Files only as the agency declares an entry for them", async () => {
    const nodes = [filesEntry("files", "Files"), backlogEntry("backlogs", "Backlogs", "b1"), workflowEntry("start", "Start", "W-2", "Record a visit")];
    const { container } = await homeRows(declared(nodes));
    expect(rowsBelowStrip(container)).toEqual(["Files", "Backlogs", "Start"]);
  });

  it("draws a › after a section's row", async () => {
    const { container } = await homeRows(declared([registers, work]));
    expect(rowOf(container, "Registers").querySelector(".end")?.textContent).toBe("›");
  });

  it("opens a workflow entry on a screen of that workflow, away from Home", async () => {
    const user = userEvent.setup();
    const { container } = await homeRows(declared([workflowEntry("visit", "Record a visit", "W-2", "Record a visit")]));
    await user.click(rowOf(container, "Record a visit"));
    expect(landed).not.toBe("/a/alego/home");
    expect(landed.startsWith("/a/alego/")).toBe(true);
  });

  it("opens a section's row on the section's page", async () => {
    const user = userEvent.setup();
    const { container } = await homeRows(declared([registers, work]));
    await user.click(rowOf(container, "Registers"));
    expect(landed).toBe("/a/alego/home/registers");
  });

  it.each([
    ["a backlog entry on the backlog's issue list", backlogEntry("work", "Work", "b1"), () => issuesPath("b1")],
    ["a files entry on Files", filesEntry(), () => filesHomePath()],
    ["a menu entry on that menu item's screen", menuEntry("biz", "Businesses", "residents/Businesses"), () => residentPaths.businesses.path()],
    ["a start entry on Start", startEntry("start", "My work"), () => "/a/alego/do-something"],
    ["an ongoing entry on Ongoing", ongoingEntry("ongoing", "Under way"), () => "/a/alego/ongoing"],
  ] as [string, HomeNode, () => string][])("opens %s", async (_name, node, path) => {
    const user = userEvent.setup();
    const { container } = await homeRows(declared([node], { records: [{ code: "RC-1", name: "Farms", canAdd: true }] }));
    await user.click(rowOf(container, node.title));
    expect(landed).toBe(path());
  });
});

describe("the icon of a Home row", () => {
  const iconOf = (container: HTMLElement, title: string) => rowOf(container, title).querySelector("svg")?.getAttribute("data-icon");

  it("is the named icon when the app ships it", async () => {
    const { container } = await homeRows(declared([section("people", "People we serve", [filesEntry()], { icon: "users" })]));
    expect(iconOf(container, "People we serve")).toBe("users");
  });

  it("is a folder for a section that names none", async () => {
    const { container } = await homeRows(declared([section("plain", "Plain", [filesEntry()])]));
    expect(iconOf(container, "Plain")).toBe("folder");
  });

  it("is drawn as a shipped icon, the same one as when the node names none, when the app does not ship the name", async () => {
    const nodes = [section("odd", "Odd section", [filesEntry()], { icon: "no-such-icon" }), section("bare", "Bare section", [filesEntry()]), backlogEntry("work", "Odd entry", "b1", { icon: "no-such-icon" }), backlogEntry("work2", "Bare entry", "b1")];
    const { container } = await homeRows(declared(nodes));
    expect(iconNames).toContain(iconOf(container, "Odd section"));
    expect(iconOf(container, "Odd section")).toBe(iconOf(container, "Bare section"));
    expect(iconNames).toContain(iconOf(container, "Odd entry"));
    expect(iconOf(container, "Odd entry")).toBe(iconOf(container, "Bare entry"));
  });

  it("is never an empty mark, whatever the name", async () => {
    const { container } = await homeRows(declared([section("odd", "Odd", [filesEntry()], { icon: "NO SUCH ICON" })]));
    expect(rowOf(container, "Odd").querySelector("svg")).not.toBeNull();
  });
});

describe("the titles of Home rows", () => {
  const withTitles = (titles: Record<string, string>) => declared([section("registers", "Registers", [filesEntry()], { titles }), backlogEntry("work", "Work", "b1", { titles: { hu: "Munka" } })]);

  it("says title when the app is in English and the node has no English text", async () => {
    const { container } = await homeRows(withTitles({ sw: "Rejista" }));
    expect(rowsBelowStrip(container)).toEqual(["Registers", "Work"]);
  });

  it("says titles.en when the node has it", async () => {
    const { container } = await homeRows(withTitles({ en: "Record books" }));
    expect(rowsBelowStrip(container)[0]).toBe("Record books");
  });

  it("says titles.sw in Swahili, and falls back to title for the node that has no Swahili text", async () => {
    useLanguageCode("sw");
    const { container } = await homeRows(withTitles({ sw: "Rejista" }));
    expect(rowsBelowStrip(container)).toEqual(["Rejista", "Work"]);
  });

  it("says titles.hu in Hungarian, and falls back to title for the node that has no Hungarian text", async () => {
    useLanguageCode("hu");
    const { container } = await homeRows(withTitles({ sw: "Rejista" }));
    expect(rowsBelowStrip(container)).toEqual(["Registers", "Munka"]);
  });

  it("matches the exact code the app holds, so a title in de is shown in German", async () => {
    useLanguageCode("de");
    const { container } = await homeRows(withTitles({ de: "Verzeichnisse", sw: "Rejista" }));
    expect(rowsBelowStrip(container)).toEqual(["Verzeichnisse", "Work"]);
  });

  it("falls back to title in a language the node has no text for, even where the app has no word table", async () => {
    useLanguageCode("fr");
    const { container } = await homeRows(withTitles({ sw: "Rejista" }));
    expect(rowsBelowStrip(container)).toEqual(["Registers", "Work"]);
  });

  it("never says the other language's text", async () => {
    useLanguageCode("hu");
    await homeRows(withTitles({ sw: "Rejista" }));
    expect(screen.queryByText("Rejista")).not.toBeInTheDocument();
  });
});

describe("a declared Home with nothing for this person", () => {
  it("shows the strip and an empty card, not the fixed Home and not a failure line", async () => {
    const shown = showHome(declared([backlogEntry("work", "Work", "b9"), section("s", "S", [backlogEntry("w2", "W", "b9")])], { files: false }));
    await screen.findByText(needsYouWords(3));
    await waitFor(() => expect(emptyCardOf(shown.container)).not.toBeNull());
    await settle();
    expect(rowsBelowStrip(shown.container)).toEqual([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("a row page on Home", () => {
  it("is never listed as a row, though it holds nodes the person may see", async () => {
    const nodes = [recordEntry("projects", "Projects", "RC-4"), rowPage("project-page", "Project", "RC-4", [filesEntry("f", "Project files")]), filesEntry("shared", "Shared files")];
    const { container } = await homeRows(declared(nodes));
    expect(rowsBelowStrip(container)).toEqual(["Projects", "Shared files"]);
  });
});
