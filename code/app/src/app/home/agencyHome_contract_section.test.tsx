import { vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, backlogEntry, everyFact, filesEntry, forgetLanded, landed, recordEntry, rowOf, rowTitles, section, showSection, useLanguageCode, workflowEntry, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const deep = section(
  "registers",
  "Registers",
  [
    recordEntry("intro", "Introduction", "RC-1"),
    section(
      "farms",
      "Farms",
      [
        section("fields", "Fields", [filesEntry("field-files", "Field files"), recordEntry("field-list", "All fields", "RC-2")], { titles: { sw: "Mashamba" } }),
        workflowEntry("farm-visit", "Record a visit", "W-2", "Record a visit"),
        backlogEntry("farm-work", "Farm work", "b1"),
      ],
      { titles: { sw: "Mashamba ya wakulima" } },
    ),
    filesEntry(),
  ],
  { titles: { sw: "Rejista" } },
);

const declared = (over: Setup = {}): Setup => ({ ...everyFact, nodes: [deep, backlogEntry("work", "Work", "b1")], records: [{ code: "RC-1", name: "Intro", canAdd: true }, { code: "RC-2", name: "Fields", canAdd: true }], ...over });

const page = async (key: string, over: Setup = {}, state?: unknown) => {
  const shown = showSection(key, declared(over), state);
  await waitFor(() => expect(screen.getByRole("main")).toBeInTheDocument());
  await waitFor(() => expect(rowTitles(shown.container).length).toBeGreaterThan(0));
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

describe("a section's page", () => {
  it("lists the section's shown nodes as rows, in declared order", async () => {
    const { container } = await page("registers");
    expect(rowTitles(container)).toEqual(["Introduction", "Farms", "Files"]);
  });

  it("draws a › after the sections and none after the entries", async () => {
    const { container } = await page("registers");
    expect(rowOf(container, "Farms").querySelector(".end")?.textContent).toBe("›");
    expect(rowOf(container, "Introduction").querySelector(".end")).toBeNull();
    expect(rowOf(container, "Files").querySelector(".end")).toBeNull();
  });

  it("lists entries and sections as declared, at every depth, and its workflows under the Workflows heading", async () => {
    const { container } = await page("farms");
    expect(rowTitles(container)).toEqual(["Fields", "Farm work", "Record a visit"]);
    expect(screen.getByRole("heading", { level: 2, name: "Workflows" })).toBeInTheDocument();
  });

  it("says the section's title as its page title", async () => {
    await page("farms");
    expect(screen.getByRole("heading", { level: 1, name: "Farms" })).toBeInTheDocument();
  });

  it("says the section's title in the person's language, and the nested rows in theirs too", async () => {
    useLanguageCode("sw");
    const { container } = await page("registers");
    expect(screen.getByRole("heading", { level: 1, name: "Rejista" })).toBeInTheDocument();
    expect(rowTitles(container)).toEqual(["Introduction", "Mashamba ya wakulima", "Files"]);
  });

  it("opens a section row on that section's page", async () => {
    const user = userEvent.setup();
    const { container } = await page("registers");
    await user.click(rowOf(container, "Farms"));
    expect(landed).toBe("/a/alego/home/farms");
  });

  it("opens a record entry on the record's list, the route carrying the entry's own key", async () => {
    const user = userEvent.setup();
    const { container } = await page("registers");
    await user.click(rowOf(container, "Introduction"));
    expect(landed).toBe("/a/alego/home/intro/records/RC-1");
  });

  it("draws no icon mark on the rows of a section's page, as the fixed menu's section page draws none", async () => {
    const { container } = await page("registers");
    expect(container.querySelectorAll("button.row svg")).toHaveLength(0);
  });

  it("goes to Home for a key the declaration does not hold", async () => {
    showSection("no-such-section", declared());
    await waitFor(() => expect(landed).toBe("/a/alego/home"));
  });
});

describe("Back on a section's page goes up one level", () => {
  it("reads Home and goes to Home from a top-level section", async () => {
    const user = userEvent.setup();
    await page("registers");
    await user.click(screen.getByRole("button", { name: "‹ Home" }));
    expect(landed).toBe("/a/alego/home");
  });

  it("reads the parent's title and goes to the parent's page from a level-2 section", async () => {
    const user = userEvent.setup();
    await page("farms");
    await user.click(screen.getByRole("button", { name: "‹ Registers" }));
    expect(landed).toBe("/a/alego/home/registers");
  });

  it("goes from level 3 to level 2, not to Home", async () => {
    const user = userEvent.setup();
    await page("fields");
    const back = screen.getByRole("button", { name: "‹ Farms" });
    await user.click(back);
    expect(landed).toBe("/a/alego/home/farms");
  });

  it("reaches Home from level 3 in three Backs", async () => {
    const user = userEvent.setup();
    await page("fields");
    await user.click(screen.getByRole("button", { name: "‹ Farms" }));
    expect(landed).toBe("/a/alego/home/farms");
    cleanup();
    await page("farms");
    await user.click(screen.getByRole("button", { name: "‹ Registers" }));
    expect(landed).toBe("/a/alego/home/registers");
    cleanup();
    await page("registers");
    await user.click(screen.getByRole("button", { name: "‹ Home" }));
    expect(landed).toBe("/a/alego/home");
  });

  it("goes up one level also when the page was opened by a deep link, with no navigation state and no history", async () => {
    const user = userEvent.setup();
    await page("fields", {}, undefined);
    await user.click(screen.getByRole("button", { name: "‹ Farms" }));
    expect(landed).toBe("/a/alego/home/farms");
  });

  it("goes up one level when the state names some other place", async () => {
    const user = userEvent.setup();
    await page("fields", {}, { from: { path: "/a/alego/menu/issues", title: "Issues & Requests", sectionId: "issues" } });
    await user.click(screen.getByRole("button", { name: "‹ Farms" }));
    expect(landed).toBe("/a/alego/home/farms");
  });

  it("keeps the word Home for Back from a top-level section, in every language", async () => {
    useLanguageCode("sw");
    await page("registers");
    expect(screen.getByRole("button", { name: "‹ Home" })).toBeInTheDocument();
  });

  it("says the parent's title in the person's language", async () => {
    useLanguageCode("sw");
    await page("farms");
    expect(screen.getByRole("button", { name: "‹ Rejista" })).toBeInTheDocument();
  });
});
