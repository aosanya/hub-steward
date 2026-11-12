import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { issuePath } from "../backlogs/paths";
import type { StartClient } from "../coordinator/start/api";
import { InboxPage } from "../pages/InboxPage";
import { routes } from "../routes";
import type { InboxClient, NotificationItem } from "./api";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const note = (over: Partial<NotificationItem>): NotificationItem => ({
  id: "n1",
  event: "new_form",
  subjectKind: "survey",
  subjectId: "s1",
  names: {},
  createdAt: "2026-10-28T10:40:00Z",
  read: false,
  ...over,
});

const clientOf = (notes: NotificationItem[]): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const quietStart = { waiting: async () => [] } as unknown as StartClient;

function Where() {
  return <p>{`at ${useLocation().pathname}`}</p>;
}

const show = (client: InboxClient) =>
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <Routes>
        <Route path="/inbox" element={<InboxPage client={client} start={quietStart} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("a notification row opens its subject", () => {
  it.each([
    ["survey_reached", "survey", "s1", () => routes.form.path({ id: "s1" })],
    ["new_form", "form", "f1", () => routes.form.path({ id: "f1" })],
    ["form_published", "survey", "s2", () => routes.form.path({ id: "s2" })],
    ["task_assigned", "task", "t1", () => issuePath("t1")],
    ["group_join_approved", "group", "g1", () => routes.roomThreads.path({ roomId: "g1" })],
    ["joined", "group", "g2", () => routes.roomThreads.path({ roomId: "g2" })],
  ])("opens the subject of %s", async (event, subjectKind, subjectId, expected) => {
    const client = clientOf([note({ event, subjectKind, subjectId })]);
    show(client);
    const title = await screen.findByText(/./, { selector: ".selrow .ttl" });
    await userEvent.click(title.closest("button") as HTMLElement);
    expect(await screen.findByText(`at ${expected()}`)).toBeInTheDocument();
    expect(client.markRead).toHaveBeenCalledWith(["n1"]);
  });
});

describe("a notification row that opens nothing", () => {
  it.each([
    ["ask_waiting", "ask"],
    ["draft_waiting", "draft"],
    ["quote_sent", "quote"],
    ["supplier_approved", "poster"],
    ["new_form", ""],
  ])("shows no unread dot and no button for %s", async (event, subjectKind) => {
    show(clientOf([note({ event, subjectKind, subjectId: subjectKind ? "x1" : "" })]));
    const row = (await screen.findByText(/./, { selector: ".selrow .ttl" })).closest(".row") as HTMLElement;
    expect(row.tagName).toBe("DIV");
    expect(within(row).queryByLabelText("Unread")).toBeNull();
    expect(within(row).queryByText("›")).toBeNull();
  });

  it("still lets the member tick it and mark it read", async () => {
    const client = clientOf([note({ id: "a1", event: "ask_waiting", subjectKind: "ask", subjectId: "k1" })]);
    show(client);
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(client.markRead).toHaveBeenCalledWith(["a1"]);
  });
});
