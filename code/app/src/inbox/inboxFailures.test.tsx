import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { StartClient } from "../coordinator/start/api";
import { InboxPage } from "../pages/InboxPage";
import { McpError } from "../wakala/mcp";
import type { InboxClient, InvitationItem, NotificationItem } from "./api";

const note: NotificationItem = {
  id: "n1",
  event: "joined",
  subjectKind: "group",
  subjectId: "g1",
  names: { group: "Siaya farmers" },
  createdAt: "2026-10-28T10:40:00Z",
  read: false,
};
const invitation: InvitationItem = { id: "i1", groupName: "Supplier", inviterName: "Grace", expiresInDays: 5 };

const fake = (over: Partial<InboxClient> = {}): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  markRead: vi.fn().mockResolvedValue(0),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
  ...over,
});
const quietStart = { waiting: async () => [] } as unknown as StartClient;
const show = (client: InboxClient) =>
  render(
    <MemoryRouter>
      <InboxPage client={client} start={quietStart} />
    </MemoryRouter>,
  );

describe("Home when a call fails", () => {
  it("stays calm when the agency has no comm module", async () => {
    show(
      fake({
        listNotifications: vi.fn().mockRejectedValue(new McpError("comm_notification_list: unknown tool")),
        listInvitations: vi.fn().mockRejectedValue(new McpError("actor_list_invitations: unknown tool")),
      }),
    );
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers Try again for a real outage and reloads", async () => {
    const list = vi.fn().mockRejectedValueOnce(new McpError("wakala answered 503: down")).mockResolvedValue([note]);
    show(fake({ listNotifications: list }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Home could not be loaded.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Siaya farmers/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("treats a network failure as an outage", async () => {
    show(fake({ listNotifications: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) }));
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("draws the failure alone when the invitations cannot be read and nothing else is there", async () => {
    show(fake({ listInvitations: vi.fn().mockRejectedValue(new Error("actor down")) }));
    await screen.findByText("Home could not be loaded.");
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("says so and keeps the invitation when joining is refused", async () => {
    const accept = vi.fn().mockRejectedValue(new Error("refused"));
    show(fake({ listInvitations: vi.fn().mockResolvedValue([invitation]), acceptInvitation: accept }));
    await userEvent.click(await screen.findByText("You are invited to Supplier"));
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not join the group. Try again.");
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(screen.queryByText("You joined. The group's room is on Chat.")).toBeNull();
  });

  it("says so and keeps the invitation when declining is refused, then clears the message on going back", async () => {
    const decline = vi.fn().mockRejectedValue(new Error("refused"));
    show(fake({ listInvitations: vi.fn().mockResolvedValue([invitation]), declineInvitation: decline }));
    await userEvent.click(await screen.findByText("You are invited to Supplier"));
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not decline the invitation. Try again.");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("You are invited to Supplier")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the message when the next attempt works", async () => {
    const accept = vi.fn().mockRejectedValueOnce(new Error("refused")).mockResolvedValue(undefined);
    show(fake({ listInvitations: vi.fn().mockResolvedValue([invitation]), acceptInvitation: accept }));
    await userEvent.click(await screen.findByText("You are invited to Supplier"));
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("You joined. The group's room is on Chat.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says so and keeps the dot when Mark all read is refused", async () => {
    const markRead = vi.fn().mockRejectedValue(new Error("refused"));
    show(fake({ listNotifications: vi.fn().mockResolvedValue([note]), markRead }));
    await userEvent.click(await screen.findByRole("button", { name: "Mark all read" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not mark the notifications read. Try again.");
    expect(screen.getByRole("img", { name: "Unread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });
});
