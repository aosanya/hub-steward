import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StartClient } from "../coordinator/start/api";
import { swahili } from "../entry/swahili";
import { words } from "../entry/words";
import { NotificationsPage } from "../pages/NotificationsPage";
import { TabBar } from "../ui/TabBar";
import * as mcp from "../wakala/mcp";
import { mcpInboxClient } from "./api";
import { chatWordings } from "./chatNotice";
import { noticeWordings } from "./notice";
import { routes } from "../routes";
import { chatTab, tabRoute } from "../tabs";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const room = "3059d273-5a41-4d9e-9c52-0b7d1e6f8a21";

const liveRow = (id: string, over: Record<string, unknown> = {}) => ({
  ActorID: "a-lead",
  AuthorActorID: "a-asha",
  Category: "chat",
  CreatedAt: "2026-11-02T16:55:00Z",
  Event: "thread_requested",
  ID: id,
  Names: null,
  ReadAt: null,
  SeatRoleKindID: "",
  SeatStructureID: "",
  StructureID: room,
  SubjectID: `cthread-${id}`,
  SubjectKind: "chat_thread",
  ...over,
});

const answer = (rows: unknown[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "comm_notification_list") return { items: rows } as never;
    if (tool === "actor_list_my_invitations") return { items: [] } as never;
    return {} as never;
  });

const quietStart = { waiting: async () => [] } as unknown as StartClient;

function Landed() {
  const { roomId, threadId } = useParams();
  return <p>{`landed in room ${roomId} thread ${threadId}`}</p>;
}

const show = () =>
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <Routes>
        <Route path="/inbox" element={<NotificationsPage client={{ ...mcpInboxClient }} start={quietStart} />} />
        <Route path={routes.roomThread.pattern} element={<Landed />} />
        <Route path={tabRoute(chatTab)} element={<p>the chat list</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("the Inbox over the live comm_notification_list answer", () => {
  it("words both thread_requested rows and never prints the event name", async () => {
    answer([liveRow("1"), liveRow("2")]);
    show();
    expect(await screen.findAllByText(words.inboxThreadRequested)).toHaveLength(2);
    expect(screen.queryByText("thread_requested")).toBeNull();
  });

  it("opens the thread a thread_requested row points at in its room", async () => {
    answer([liveRow("1")]);
    show();
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(words.inboxThreadRequested) }));
    expect(await screen.findByText(`landed in room ${room} thread cthread-1`)).toBeInTheDocument();
  });

  it("names the person and the group when the row carries them", async () => {
    answer([liveRow("1", { Names: { author: "Asha Otieno", group: "Siaya farmers" } })]);
    show();
    const row = (await screen.findByText("Asha Otieno asked for a thread")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Siaya farmers")).toBeInTheDocument();
  });

  it("invents no name when the row carries none", async () => {
    answer([liveRow("1")]);
    show();
    const row = (await screen.findByText(words.inboxThreadRequested)).closest(".row") as HTMLElement;
    expect(row.querySelector(".meta")).toBeNull();
  });

  it("words the request in Kiswahili when that is the chosen language", async () => {
    window.localStorage.setItem("hub.language", "sw");
    answer([liveRow("1", { Names: { author: "Asha Otieno" } })]);
    show();
    expect(await screen.findByText(swahili.inboxThreadRequestedBy.replace("{name}", "Asha Otieno"))).toBeInTheDocument();
    expect(screen.queryByText("thread_requested")).toBeNull();
  });

  it("gives an unknown kind a neutral word and still opens its thread", async () => {
    answer([liveRow("1", { Event: "a_kind_nobody_wrote_down" })]);
    show();
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(words.inboxNotification) }));
    expect(screen.queryByText("a_kind_nobody_wrote_down")).toBeNull();
    expect(await screen.findByText(`landed in room ${room} thread cthread-1`)).toBeInTheDocument();
  });

  it("gives an unknown kind with no thread a neutral word and no tap target", async () => {
    answer([liveRow("1", { Event: "a_kind_nobody_wrote_down", SubjectKind: "survey", SubjectID: "s1" })]);
    show();
    const row = (await screen.findByText(words.inboxNotification)).closest(".row") as HTMLElement;
    expect(row.tagName).toBe("DIV");
    expect(screen.queryByText("a_kind_nobody_wrote_down")).toBeNull();
  });

  it("falls back to the chat list when the thread row names no room", async () => {
    answer([liveRow("1", { StructureID: "" })]);
    show();
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(words.inboxThreadRequested) }));
    expect(await screen.findByText("the chat list")).toBeInTheDocument();
  });

  it.each([
    ["thread_requested", "Someone asked for a thread"],
    ["thread_declined", "Your request for a thread was declined"],
    ["thread_reply", "There is a new reply"],
    ["record_message", "There is a new message about your record"],
    ["message_removed", "A message of yours was removed"],
    ["record_access_ended", "Your access to a record ended"],
  ])("words %s as a sentence", async (event, sentence) => {
    answer([liveRow("1", { Event: event })]);
    show();
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(screen.queryByText(event)).toBeNull();
  });

  it.each([...chatWordings.entries()])("has Kiswahili words for %s and for the person who did it", (_event, wording) => {
    expect(swahili[wording.bare]).not.toBe(words[wording.bare]);
    if (wording.byPerson) expect(swahili[wording.byPerson]).toContain("{name}");
  });

  it("words the neutral fallback in Kiswahili", async () => {
    window.localStorage.setItem("hub.language", "sw");
    answer([liveRow("1", { Event: "a_kind_nobody_wrote_down" })]);
    show();
    expect(await screen.findByText(swahili.inboxNotification)).toBeInTheDocument();
  });

  it("holds the table to exactly the events the comm module raises", () => {
    expect([...chatWordings.keys()].sort()).toEqual(["message_removed", "record_access_ended", "record_message", "thread_declined", "thread_reply", "thread_requested"]);
  });
});

const raisedEvents: [string, string, string][] = [
  ["group_join_approved", "group", "You joined a group"],
  ["group_join_declined", "group_join_decision", "Request declined"],
  ["join_requested", "group_join_request", "Join request"],
  ["group_invited", "group", "You are invited to join a group"],
  ["group_member_removed", "group", "You were removed from a group"],
  ["survey_reached", "survey", "New form"],
  ["results_published", "survey", "Results are in"],
  ["supplier_approved", "poster", "You are approved as a supplier"],
  ["ask_waiting", "ask", "An ask is waiting for your answer"],
  ["ask_answered", "ask", "Your ask was answered"],
  ["revision_asked", "group_order", "The shop asked to revise the group order"],
  ["ask_closed", "ask", "Nobody answered"],
  ["group_order_called_off", "group_order", "The group order was called off"],
  ["notice_posted", "notice", "A new notice was posted"],
  ["quote_sent", "quote", "A quote was sent on your notice"],
  ["draft_waiting", "draft", "A draft counter is waiting for you"],
  ["counter_sent", "quote", "A counter was sent on your quote"],
  ["case_opened", "case", "Your request was opened"],
  ["case_closed", "case", "Your request was closed"],
  ["task_assigned", "task", "An issue was assigned to you"],
];

const shownEvents = raisedEvents.filter(([event]) => event !== "group_invited");

const rowOf = (event: string, kind: string, over: Record<string, unknown> = {}) =>
  liveRow("1", { Event: event, SubjectKind: kind, SubjectID: `${kind}-1`, StructureID: "", ...over });

describe("the Inbox words the events other modules raise, over the live answer", () => {
  it.each(shownEvents)("words %s as a sentence and never prints the event name", async (event, kind, sentence) => {
    answer([rowOf(event, kind)]);
    show();
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(screen.queryByText(event)).toBeNull();
    expect(screen.queryByText(words.inboxNotification)).toBeNull();
  });

  it.each(shownEvents)("words %s in Kiswahili when that is the chosen language", async (event, kind, sentence) => {
    window.localStorage.setItem("hub.language", "sw");
    answer([rowOf(event, kind)]);
    show();
    const wording = noticeWordings.get(event)!;
    expect(await screen.findByText(swahili[wording.title])).toBeInTheDocument();
    expect(screen.queryByText(sentence)).toBeNull();
    expect(screen.queryByText(event)).toBeNull();
  });

  it("has Kiswahili words, unlike the English, for every title and line in the table", () => {
    const keys = [...noticeWordings.values()].flatMap((w) => [w.title, w.titleNamed?.words, w.line, w.lineNamed?.words]).filter((k): k is keyof typeof words => Boolean(k));
    expect(keys.length).toBeGreaterThan(raisedEvents.length);
    keys.forEach((key) => expect(swahili[key], key).not.toBe(words[key]));
  });

  it("holds the table to the events a Siaya farmers member can receive, and the names the screen kept", () => {
    expect([...noticeWordings.keys()].sort()).toEqual(
      [...raisedEvents.map(([event]) => event), "joined", "request_approved", "invited", "form_published", "new_form"].sort(),
    );
  });

  it("names the group a join was approved for, in either language, and says the request was approved", async () => {
    answer([rowOf("group_join_approved", "group", { Names: { group: "Siaya farmers" } })]);
    const view = show();
    const row = (await screen.findByText("You joined Siaya farmers")).closest(".row") as HTMLElement;
    expect(within(row).getByText(words.inboxJoinApprovedLine)).toBeInTheDocument();
    view.unmount();
    window.localStorage.setItem("hub.language", "sw");
    show();
    const swRow = (await screen.findByText("Umejiunga na Siaya farmers")).closest(".row") as HTMLElement;
    expect(within(swRow).getByText(swahili.inboxJoinApprovedLine)).toBeInTheDocument();
  });

  it("shows a join approved with no group name beside its line, never a gap", async () => {
    answer([rowOf("group_join_approved", "group")]);
    show();
    const row = (await screen.findByText("You joined a group")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Your request was approved.")).toBeInTheDocument();
  });

  it("names the product of a called-off group order in Kiswahili", async () => {
    window.localStorage.setItem("hub.language", "sw");
    answer([rowOf("group_order_called_off", "group_order", { Names: { product: "maize" } })]);
    show();
    expect(await screen.findByText("Agizo la kikundi la maize limeghairiwa")).toBeInTheDocument();
  });

  it("words a closed ask and its line in Kiswahili", async () => {
    window.localStorage.setItem("hub.language", "sw");
    answer([rowOf("ask_closed", "ask", { Names: { line: "a delivery" } }), rowOf("ask_closed", "ask", { ID: "2" })]);
    show();
    expect(await screen.findByText("Ombi lako la a delivery limefungwa.")).toBeInTheDocument();
    expect(screen.getByText(swahili.inboxAskClosedLine)).toBeInTheDocument();
    expect(screen.queryByText(/closed/)).toBeNull();
  });

  it("says who approved a supplier and for which group, the names a live supplier_approved row carries", async () => {
    answer([rowOf("supplier_approved", "poster", { Names: { person: "Grace Adhiambo", group: "Siaya farmers" } })]);
    show();
    expect(await screen.findByText("Grace Adhiambo · Siaya farmers")).toBeInTheDocument();
  });

  it("takes a name with a dollar sign as it is", async () => {
    answer([rowOf("group_join_approved", "group", { Names: { group: "Fund $& Co" } })]);
    show();
    expect(await screen.findByText("You joined Fund $& Co")).toBeInTheDocument();
  });
});

describe("tapping a live row", () => {
  const stamp = "2026-11-02T17:00:00Z";

  const server = (rows: ReturnType<typeof liveRow>[], mark: { delayMs?: number; fails?: boolean; listDelayMs?: number } = {}) => {
    const held = rows.map((row) => ({ ...row }));
    return vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
      if (tool === "comm_notification_list") {
        const items = held.map((row) => ({ ...row }));
        await new Promise((done) => setTimeout(done, mark.listDelayMs ?? 0));
        return { items } as never;
      }
      if (tool === "actor_list_my_invitations") return { items: [] } as never;
      if (tool !== "comm_notification_mark_read") return {} as never;
      if (mark.fails) throw new mcp.McpError("comm_notification_mark_read: down");
      await new Promise((done) => setTimeout(done, mark.delayMs ?? 0));
      const ids = (args as { ids: string[] }).ids;
      held.forEach((row) => {
        if (ids.includes(row.ID)) row.ReadAt = stamp as never;
      });
      return { marked: ids.length } as never;
    });
  };

  const showBeside = () => {
    const client = { ...mcpInboxClient };
    function LandedBeside() {
      const { roomId, threadId } = useParams();
      return (
        <>
          <p>{`landed in room ${roomId} thread ${threadId}`}</p>
          <TabBar inbox={client} start={quietStart} />
        </>
      );
    }
    return render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Routes>
          <Route path="/inbox" element={<NotificationsPage client={client} start={quietStart} />} />
          <Route path={routes.roomThread.pattern} element={<LandedBeside />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  const tapFirst = async () => userEvent.click((await screen.findAllByRole("button", { name: new RegExp(words.inboxThreadRequested) }))[0]);

  it("asks comm_notification_mark_read for the row's ID and opens its thread", async () => {
    const spy = server([liveRow("1"), liveRow("2")]);
    show();
    await tapFirst();
    expect(await screen.findByText(`landed in room ${room} thread cthread-1`)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("", "comm_notification_mark_read", { ids: ["1"] });
    expect(spy.mock.calls.filter(([, tool]) => tool === "comm_notification_mark_read")).toHaveLength(1);
  });

  it("opens the thread when comm_notification_mark_read is refused", async () => {
    server([liveRow("1")], { fails: true });
    show();
    await tapFirst();
    expect(await screen.findByText(`landed in room ${room} thread cthread-1`)).toBeInTheDocument();
  });

  it("shows the tab on the next screen one lower, though the list is read while the mark is still on its way", async () => {
    server([liveRow("1"), liveRow("2")], { delayMs: 30, listDelayMs: 60 });
    showBeside();
    expect(await screen.findByLabelText("2 unread notifications")).toBeInTheDocument();
    await tapFirst();
    expect(await screen.findByText(`landed in room ${room} thread cthread-1`)).toBeInTheDocument();
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
  });

  it("leaves the tab as it was on the next screen when the mark is refused", async () => {
    server([liveRow("1"), liveRow("2")], { fails: true });
    showBeside();
    expect(await screen.findByLabelText("2 unread notifications")).toBeInTheDocument();
    await tapFirst();
    expect(await screen.findByText(`landed in room ${room} thread cthread-1`)).toBeInTheDocument();
    expect(await screen.findByLabelText("2 unread notifications")).toBeInTheDocument();
  });
});

