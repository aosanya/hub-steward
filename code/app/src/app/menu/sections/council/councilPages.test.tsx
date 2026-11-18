import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AgendaMinutesScreen } from "./AgendaMinutesScreen";
import { BylawsScreen } from "./BylawsScreen";
import { CommitteesScreen } from "./CommitteesScreen";
import { CouncilEditScreen } from "./CouncilEditScreen";
import { councilTools } from "./councilData";
import { MeetingsScreen } from "./MeetingsScreens";
import { councilPaths } from "./paths";
import { ResolutionsScreen } from "./ResolutionsScreen";

type Row = { [key: string]: unknown };

let permissions: string[];
let landed = "";

const meeting: Row = { id: "m1", name: "Spring Budget Meeting", date: "2026-03-12", place: "Town Hall", committee: "Finance Committee" };
const resolution: Row = { id: "r1", meeting_id: "m1", title: "Approve the spring budget", date: "2026-03-12", outcome: "adopted" };
const bylaw: Row = { id: "b1", title: "Market stall fees", year: 2024, text: "A stall pays the daily fee." };
const committee: Row = { id: "g1", name: "Sample Finance Committee", node_type: "Committee", anchor_level_override: "lv1" };

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Row;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === councilTools.meetingList) return { items: [meeting] };
  if (name === councilTools.meetingRead) return { item: meeting };
  if (name === councilTools.agendaRead) return { meeting_id: "m1", items: ["Opening", "Budget review"] };
  if (name === councilTools.minutesRead) return { meeting_id: "m1", text: "The budget was approved." };
  if (name === councilTools.resolutionList) return { items: [resolution] };
  if (name === councilTools.resolutionRead) return resolution;
  if (name === councilTools.bylawList) return { items: [bylaw] };
  if (name === councilTools.bylawRead) return { item: bylaw };
  if (name === "actor_list_groups") return { items: [committee] };
  if (name === "actor_list_group_leaders") return { items: [{ actor_id: "a1", display_name: "Anna Sample" }] };
  if (name === "actor_list_role_kinds") return { items: [{ id: "k-chair", name: "Chair", leads_group: true }, { id: "k-member", name: "Member", leads_group: false }] };
  if (name === "actor_list_actors") return { items: [{ id: "a1", display_name: "Anna Sample" }, { id: "a2", display_name: "Ben Example" }] };
  if (name === "actor_list_role_assignments_for_group") {
    return { items: [{ id: "s1", actor_id: "a1", group_id: given.group_id, kind_id: "k-chair", active: true }, { id: "s2", actor_id: "a2", group_id: given.group_id, kind_id: "k-member", active: true }] };
  }
  throw new Error(`${name}: unknown tool`);
};

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  permissions = ["council.manage", "group.manage"];
  landed = "";
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const open = async (path: string, pattern: string, element: JSX.Element, row: RegExp) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
        <Route path={councilPaths.edit.pattern} element={<CouncilEditScreen />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: row }));
  await waitFor(() => expect(document.querySelector(".mw-detail")).not.toBeNull());
  return within(document.querySelector(".mw-detail") as HTMLElement);
};

const meetingPage = () => open(councilPaths.meetings.path(), councilPaths.meetings.pattern, <MeetingsScreen />, /Spring Budget Meeting/);
const resolutionPage = () => open(councilPaths.resolutions.path(), councilPaths.resolutions.pattern, <ResolutionsScreen />, /Approve the spring budget/);
const bylawPage = () => open(councilPaths.bylaws.path(), councilPaths.bylaws.pattern, <BylawsScreen />, /Market stall fees/);
const committeePage = () => open(councilPaths.committees.path(), councilPaths.committees.pattern, <CommitteesScreen />, /Sample Finance Committee/);
const papersPage = () => open(councilPaths.agendas.path(), councilPaths.agendas.pattern, <AgendaMinutesScreen />, /Spring Budget Meeting/);

const footOf = (card: HTMLElement) => card.querySelector(".sec-foot") as HTMLElement;

describe("a council record is a page titled by its name", () => {
  it("titles a meeting by its name with the date and place as one quiet line", async () => {
    const page = await meetingPage();

    expect(await page.findByRole("heading", { level: 1, name: "Spring Budget Meeting" })).toBeInTheDocument();
    expect(page.getByText("2026-03-12 · Town Hall", { selector: ".quiet-line" })).toBeInTheDocument();
  });

  it("titles a resolution by its title with the date and outcome as one quiet line", async () => {
    const page = await resolutionPage();

    expect(await page.findByRole("heading", { level: 1, name: "Approve the spring budget" })).toBeInTheDocument();
    expect(page.getByText("2026-03-12 · Adopted", { selector: ".quiet-line" })).toBeInTheDocument();
  });

  it("titles a bylaw by its title with the year as one quiet line", async () => {
    const page = await bylawPage();

    expect(await page.findByRole("heading", { level: 1, name: "Market stall fees" })).toBeInTheDocument();
    expect(page.getByText("2024", { selector: ".quiet-line" })).toBeInTheDocument();
  });

  it("titles a committee by its name with the chair as one quiet line", async () => {
    const page = await committeePage();

    expect(await page.findByRole("heading", { level: 1, name: "Sample Finance Committee" })).toBeInTheDocument();
    expect(page.getByText("Chair: Anna Sample", { selector: ".quiet-line" })).toBeInTheDocument();
  });

  it("titles the papers of a meeting by the meeting's name", async () => {
    const page = await papersPage();

    expect(await page.findByRole("heading", { level: 1, name: "Spring Budget Meeting" })).toBeInTheDocument();
    expect(page.getByText("2026-03-12", { selector: ".quiet-line" })).toBeInTheDocument();
  });

  it("draws no list title band above the record on a wide screen, and keeps the bottom bar", async () => {
    setWide(true);
    const page = await meetingPage();

    await page.findByRole("heading", { level: 1, name: "Spring Budget Meeting" });
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(document.querySelector(".wf-status")).toBeNull();
  });
});

describe("a council record's detail is a plain card with Edit in its footer", () => {
  it.each([
    ["meeting", meetingPage, "Meeting detail", ["Name", "Date", "Place", "Committee"]],
    ["resolution", resolutionPage, "Resolution detail", ["Title", "Date", "Outcome", "Meeting"]],
    ["bylaw", bylawPage, "Bylaw detail", ["Title", "Year", "Text"]],
    ["committee", committeePage, "Committee detail", ["Name", "Chair"]],
  ])("holds a %s's label and value rows with Edit as the one footer act", async (_kind, show, card, labels) => {
    const page = await show();

    const region = await page.findByRole("region", { name: card });
    for (const label of labels) expect(within(region).getByText(label, { selector: ".ttl" })).toBeInTheDocument();
    expect(within(footOf(region)).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(footOf(region).children).toHaveLength(1);
  });

  it("shows no Edit to a caller without the permission", async () => {
    permissions = ["council.view", "member.view"];
    const page = await meetingPage();

    const region = await page.findByRole("region", { name: "Meeting detail" });
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(within(region).queryByRole("button", { name: "Edit" })).toBeNull();
  });
});

describe("Edit opens one edit screen at the one route", () => {
  it.each([
    ["meeting", meetingPage, "/a/town/menu/council/meetings/m1/edit", "Edit meeting"],
    ["resolution", resolutionPage, "/a/town/menu/council/resolutions/r1/edit", "Edit resolution"],
    ["bylaw", bylawPage, "/a/town/menu/council/bylaws/b1/edit", "Edit bylaw"],
    ["committee", committeePage, "/a/town/menu/council/committees/g1/edit", "Edit committee"],
  ])("takes a %s to %s and titles the screen %s", async (_kind, show, path, title) => {
    const page = await show();

    await userEvent.click(await within(await page.findByRole("region", { name: /detail$/ })).findByRole("button", { name: "Edit" }));

    expect(landed).toBe(path);
    expect(await screen.findByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  });

  it("returns to the record on Cancel", async () => {
    const page = await meetingPage();
    await userEvent.click(await within(await page.findByRole("region", { name: "Meeting detail" })).findByRole("button", { name: "Edit" }));

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(landed).toBe(councilPaths.meetings.path()));
  });
});

describe("a meeting page carries the papers and the resolutions as cards", () => {
  it("shows the Agenda, Minutes and Resolutions cards, each with its own act", async () => {
    const page = await meetingPage();

    const agenda = await page.findByRole("region", { name: "Agenda" });
    expect(within(agenda).getByText("Budget review", { selector: ".ttl" })).toBeInTheDocument();
    expect(within(footOf(agenda)).getByRole("button", { name: "Edit agenda" })).toBeInTheDocument();
    const minutes = page.getByRole("region", { name: "Minutes" });
    expect(within(minutes).getByText("The budget was approved.", { selector: ".ttl" })).toBeInTheDocument();
    expect(within(footOf(minutes)).getByRole("button", { name: "Edit minutes" })).toBeInTheDocument();
    const resolutions = page.getByRole("region", { name: "Resolutions" });
    expect(within(resolutions).getByText("Approve the spring budget", { selector: ".ttl" })).toBeInTheDocument();
  });

  it("opens a resolution from the Resolutions card", async () => {
    const page = await meetingPage();

    await userEvent.click(within(await page.findByRole("region", { name: "Resolutions" })).getByRole("button", { name: /Approve the spring budget/ }));

    await waitFor(() => expect(landed).toBe(councilPaths.resolutions.path()));
  });

  it("takes Edit agenda to the agenda edit screen of the meeting", async () => {
    const page = await meetingPage();

    await userEvent.click(within(await page.findByRole("region", { name: "Agenda" })).getByRole("button", { name: "Edit agenda" }));

    expect(landed).toBe("/a/town/menu/council/agenda/m1/edit");
  });
});

describe("a committee page carries a Members card", () => {
  it("lists the members with their roles and Add member in the card's footer", async () => {
    const page = await committeePage();

    const members = await page.findByRole("region", { name: "Members" });
    expect(within(members).getByRole("heading", { name: /^Members\s*2$/ })).toBeInTheDocument();
    expect(within(members).getByText("Anna Sample", { selector: ".ttl" })).toBeInTheDocument();
    expect(within(members).getByText("Ben Example", { selector: ".ttl" })).toBeInTheDocument();
    expect(within(footOf(members)).getByRole("button", { name: "Add member" })).toBeInTheDocument();
  });
});
