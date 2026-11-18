import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, carriedChatFrom, forgetChatAbout } from "../../../chatAbout";
import { AgendaMinutesScreen } from "./AgendaMinutesScreen";
import { BylawsScreen } from "./BylawsScreen";
import { CommitteesScreen } from "./CommitteesScreen";
import { councilTools } from "./councilData";
import { MeetingsScreen } from "./MeetingsScreens";
import { councilPaths } from "./paths";
import { ResolutionsScreen } from "./ResolutionsScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = { [key: string]: unknown };

const meeting: Row = { id: "m1", name: "Spring Budget Meeting", date: "2026-03-12", place: "Town Hall", committee: "Finance Committee" };
const resolution: Row = { id: "r1", meeting_id: "m1", title: "Approve the spring budget", date: "2026-03-12", outcome: "adopted" };
const bylaw: Row = { id: "b1", title: "Market stall fees", year: 2024, text: "A stall pays the daily fee." };
const committee: Row = { id: "g1", name: "Sample Finance Committee", node_type: "Committee", anchor_level_override: "lv1" };

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Row;
  if (name === "agency_get_my_roles") return { permissions: ["council.manage", "group.manage"] };
  if (name === councilTools.meetingList) return { items: [meeting] };
  if (name === councilTools.meetingRead) return { item: meeting };
  if (name === councilTools.agendaRead) return { meeting_id: "m1", items: ["Opening"] };
  if (name === councilTools.minutesRead) return { meeting_id: "m1", text: "Approved." };
  if (name === councilTools.resolutionList) return { items: [resolution] };
  if (name === councilTools.resolutionRead) return resolution;
  if (name === councilTools.bylawList) return { items: [bylaw] };
  if (name === councilTools.bylawRead) return { item: bylaw };
  if (name === "actor_list_groups") return { items: [committee] };
  if (name === "actor_list_group_leaders") return { items: [{ actor_id: "a1", display_name: "Anna Sample" }] };
  if (name === "actor_list_role_kinds") return { items: [{ id: "k-chair", name: "Chair", leads_group: true }] };
  if (name === "actor_list_actors") return { items: [{ id: "a1", display_name: "Anna Sample" }] };
  if (name === "actor_list_role_assignments_for_group") return { items: [{ id: "s1", actor_id: "a1", group_id: given.group_id, kind_id: "k-chair", active: true }] };
  throw new Error(`${name}: unknown tool`);
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openScreen = (path: string, pattern: string, element: JSX.Element) => {
  setWide(true);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("Chat in the bar on a meeting's page", () => {
  it("opens the assistant about the chosen meeting, with Details, Agenda, Minutes and Resolutions", async () => {
    openScreen(`${councilPaths.meetings.path()}?id=m1`, councilPaths.meetings.pattern, <MeetingsScreen />);
    await screen.findByRole("heading", { level: 1, name: "Spring Budget Meeting" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Spring Budget Meeting");
    expect(screen.getByRole("textbox", { name: "Ask about Spring Budget Meeting" })).toBeInTheDocument();
    expect(carriedChatAbout()).toEqual({ kind: "meeting", id: "m1", name: "Spring Budget Meeting" });
    expect(carriedChatFrom()).toBe(`${councilPaths.meetings.path()}?id=m1`);
  });

  it("carries nothing while no meeting is chosen, so the Chat tab opens the plain assistant", async () => {
    openScreen(councilPaths.meetings.path(), councilPaths.meetings.pattern, <MeetingsScreen />);
    await screen.findByRole("button", { name: /Spring Budget Meeting/ });
    expect(carriedChatAbout()).toBeNull();
  });

  it("clears when the owner leaves the page, so the backlog assistant is restored", async () => {
    openScreen(`${councilPaths.meetings.path()}?id=m1`, councilPaths.meetings.pattern, <MeetingsScreen />);
    await screen.findByRole("heading", { level: 1, name: "Spring Budget Meeting" });
    cleanup();
    await waitFor(() => expect(carriedChatAbout()).toBeNull());
  });
});

describe("Chat in the bar on the papers of a meeting", () => {
  it("opens the assistant about the meeting", async () => {
    openScreen(`${councilPaths.agendas.path()}?id=m1`, councilPaths.agendas.pattern, <AgendaMinutesScreen />);
    await screen.findByRole("heading", { level: 1, name: "Spring Budget Meeting" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Spring Budget Meeting");
    expect(carriedChatAbout()).toEqual({ kind: "meeting", id: "m1", name: "Spring Budget Meeting" });
    expect(carriedChatFrom()).toBe(`${councilPaths.agendas.path()}?id=m1`);
  });
});

describe("Chat in the bar on a resolution's page", () => {
  it("opens the assistant about the chosen resolution, carrying the meeting it was passed at", async () => {
    openScreen(`${councilPaths.resolutions.path()}?id=r1`, councilPaths.resolutions.pattern, <ResolutionsScreen />);
    await screen.findByRole("heading", { level: 1, name: "Approve the spring budget" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Approve the spring budget");
    expect(carriedChatAbout()).toEqual({ kind: "resolution", id: "r1", name: "Approve the spring budget", extra: { meeting: "m1" } });
    expect(carriedChatFrom()).toBe(`${councilPaths.resolutions.path()}?id=r1`);
  });

  it("carries nothing while no resolution is chosen", async () => {
    openScreen(councilPaths.resolutions.path(), councilPaths.resolutions.pattern, <ResolutionsScreen />);
    await screen.findByRole("button", { name: /Approve the spring budget/ });
    expect(carriedChatAbout()).toBeNull();
  });
});

describe("Chat in the bar on a bylaw's page", () => {
  it("opens the assistant about the chosen bylaw, with its Text", async () => {
    openScreen(`${councilPaths.bylaws.path()}?id=b1`, councilPaths.bylaws.pattern, <BylawsScreen />);
    await screen.findByRole("heading", { level: 1, name: "Market stall fees" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Market stall fees");
    expect(carriedChatAbout()).toEqual({ kind: "bylaw", id: "b1", name: "Market stall fees" });
    expect(carriedChatFrom()).toBe(`${councilPaths.bylaws.path()}?id=b1`);
  });

  it("carries nothing while no bylaw is chosen", async () => {
    openScreen(councilPaths.bylaws.path(), councilPaths.bylaws.pattern, <BylawsScreen />);
    await screen.findByRole("button", { name: /Market stall fees/ });
    expect(carriedChatAbout()).toBeNull();
  });
});

describe("Chat in the bar on a committee's page", () => {
  it("opens the assistant about the chosen committee, with Details and Members", async () => {
    openScreen(`${councilPaths.committees.path()}?id=g1`, councilPaths.committees.pattern, <CommitteesScreen />);
    await screen.findByRole("heading", { level: 1, name: "Sample Finance Committee" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Sample Finance Committee");
    expect(carriedChatAbout()).toEqual({ kind: "committee", id: "g1", name: "Sample Finance Committee" });
    expect(carriedChatFrom()).toBe(`${councilPaths.committees.path()}?id=g1`);
  });

  it("carries nothing while no committee is chosen", async () => {
    openScreen(councilPaths.committees.path(), councilPaths.committees.pattern, <CommitteesScreen />);
    await screen.findByRole("button", { name: /Sample Finance Committee/ });
    expect(carriedChatAbout()).toBeNull();
  });
});
