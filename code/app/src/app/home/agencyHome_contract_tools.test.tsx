import { vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { allIssuesId } from "../../features/backlogs";
import { filesHomePath } from "../../features/files";
import { agencyId, backlogEntry, everyFact, filesEntry, recordEntry, forgetLanded, homePathOf, landed, needsYouWords, rowOf, rowTitles, section, settle, showHome, showSection, useLanguageCode, type HomeNode, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 3, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const registers = section("registers", "Registers", [filesEntry("registers-files", "Register files")]);

const farms = recordEntry("farm-list", "Farms", "RC-1");

const work = backlogEntry("work", "Work", "b1", { permission: "task.read" });

const settings = section("settings", "Settings", [filesEntry("settings-files", "Settings files")]);

const declared = (nodes: HomeNode[], over: Setup = {}): Setup => ({ ...everyFact, nodes, ...over });

const homeRowsOf = async (setup: Setup) => {
  const shown = showHome(setup);
  await screen.findByText(needsYouWords(3));
  await waitFor(() => expect(rowTitles(shown.container).length).toBeGreaterThan(1));
  await settle();
  return shown;
};

const toolsRowsOf = async (setup: Setup) => {
  const shown = showSection("tools", setup);
  await screen.findAllByRole("button", { name: /Backlogs|Files/ });
  return rowTitles(shown.container);
};

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
  window.localStorage.removeItem("hub.language");
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
  window.localStorage.removeItem("hub.language");
});

describe("the Tools row of a declared Home", () => {
  it("comes after the agency's own sections and entries", async () => {
    const { container } = await homeRowsOf(declared([registers, work]));
    expect(rowTitles(container)).toEqual([needsYouWords(3), "Registers", "Work", "Tools"]);
  });

  it("comes before Settings, so Settings is the last row when the agency has it", async () => {
    const { container } = await homeRowsOf(declared([registers, settings, work]));
    expect(rowTitles(container)).toEqual([needsYouWords(3), "Registers", "Work", "Tools", "Settings"]);
  });

  it("draws the tools icon and a chevron, and no subtitle", async () => {
    const { container } = await homeRowsOf(declared([registers]));
    const row = rowOf(container, "Tools");
    expect(row.querySelector("svg")?.getAttribute("data-icon")).toBe("tools");
    expect(row.querySelector(".end")?.textContent).toBe("›");
    expect(row.querySelector(".meta")).toBeNull();
  });

  it("opens the Tools screen", async () => {
    const user = userEvent.setup();
    const { container } = await homeRowsOf(declared([registers]));
    await user.click(rowOf(container, "Tools"));
    expect(landed).toBe("/a/alego/home/tools");
  });

  it("is named in Swahili and in Hungarian", async () => {
    useLanguageCode("sw");
    const swahili = await homeRowsOf(declared([registers]));
    expect(rowTitles(swahili.container)).toContain("Zana");
    cleanup();
    useLanguageCode("hu");
    const magyar = await homeRowsOf(declared([registers]));
    expect(rowTitles(magyar.container)).toContain("Eszközök");
  });

  it.each([
    ["no backlog is seen and Files is not mounted", { backlogs: [], files: false }],
    ["only the all-issues list is seen and Files is not mounted", { backlogs: [{ id: allIssuesId, name: "All issues" }], files: false }],
    ["the person may not read backlogs and Files is not mounted", { permissions: ["resident.read"], files: false }],
    ["the taskmanager module is off and Files is not mounted", { modules: ["actor"], files: false }],
  ] as [string, Setup][])("is left out when %s", async (_name, over) => {
    const { container } = await homeRowsOf(declared([farms], over));
    expect(rowTitles(container)).toEqual([needsYouWords(3), "Farms"]);
  });

  it("is left out, with no failure line, when only the Files check fails and no backlog is seen", async () => {
    const { container } = await homeRowsOf(declared([farms], { backlogs: [], down: { files: true } }));
    expect(rowTitles(container)).toEqual([needsYouWords(3), "Farms"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the Tools screen", () => {
  it("lists Backlogs and then Files", async () => {
    expect(await toolsRowsOf(declared([registers]))).toEqual(["Backlogs", "Files"]);
  });

  it("leaves out Files when Files is not mounted, and Backlogs when none is seen", async () => {
    expect(await toolsRowsOf(declared([registers], { files: false }))).toEqual(["Backlogs"]);
    cleanup();
    expect(await toolsRowsOf(declared([registers], { backlogs: [] }))).toEqual(["Files"]);
  });

  it("leaves out Files, with no failure line, when the Files check fails", async () => {
    expect(await toolsRowsOf(declared([farms], { down: { files: true } }))).toEqual(["Backlogs"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens the backlogs list of the open agency, not one backlog", async () => {
    const user = userEvent.setup();
    showSection("tools", declared([registers]));
    await user.click(await screen.findByRole("button", { name: "Backlogs" }));
    expect(landed).toBe("/a/alego/backlogs");
  });

  it("opens Files", async () => {
    const user = userEvent.setup();
    showSection("tools", declared([registers]));
    await user.click(await screen.findByRole("button", { name: "Files" }));
    expect(landed).toBe(filesHomePath());
  });

  it("is a screen of an agency that declares nothing, so today's Home can open it", async () => {
    expect(await toolsRowsOf({ ...everyFact, nodes: [] })).toEqual(["Backlogs", "Files"]);
  });

  it("goes to Home when there is nothing to list in it", async () => {
    showSection("tools", declared([registers], { backlogs: [], files: false }));
    await waitFor(() => expect(landed).toBe(homePathOf(agencyId)));
  });

  it("goes back to Home", async () => {
    const user = userEvent.setup();
    showSection("tools", declared([registers]));
    await user.click(await screen.findByRole("button", { name: /Home/ }));
    expect(landed).toBe(homePathOf(agencyId));
  });
});
