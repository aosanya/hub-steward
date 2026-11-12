import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { StartClient } from "../coordinator/start/api";
import { NotificationsPage } from "../pages/NotificationsPage";
import { McpError } from "../wakala/mcp";
import type { InboxClient, NotificationItem } from "./api";
import type { Reader } from "./subjectCheck";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const note = (over: Partial<NotificationItem>): NotificationItem => ({
  id: "n1",
  event: "new_form",
  subjectKind: "form",
  subjectId: "f1",
  names: { form: "Seed order" },
  createdAt: "2026-11-12T10:00:00Z",
  read: false,
  ...over,
});

const fake = (notes: NotificationItem[]): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const start = { waiting: async () => [] } as unknown as StartClient;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const show = (client: InboxClient, read: Reader) =>
  render(
    <MemoryRouter>
      <NotificationsPage client={client} start={start} read={read} />
      <Where />
    </MemoryRouter>,
  );

describe("the Notifications page checks what a notification is about", () => {
  it("clears a task that is done from Needs you", async () => {
    const task = note({ id: "a1", event: "task_assigned", subjectKind: "task", subjectId: "t1", names: {} });
    const client = fake([task]);
    const read: Reader = vi.fn().mockResolvedValue({ status: "completed" });
    show(client, read);
    await waitFor(() => expect(client.markRead).toHaveBeenCalledWith(["a1"]));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Needs you" })).toBeNull());
  });

  it("keeps a task that is still open under Needs you", async () => {
    const task = note({ id: "a1", event: "task_assigned", subjectKind: "task", subjectId: "t1", names: {} });
    const client = fake([task]);
    const read: Reader = vi.fn().mockResolvedValue({ status: "pending" });
    show(client, read);
    await screen.findByRole("heading", { name: "Needs you" });
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(client.markRead).not.toHaveBeenCalled();
  });

  it("says a form that vanished is no longer there and does not open it", async () => {
    const client = fake([note({})]);
    const read: Reader = vi.fn().mockRejectedValue(new McpError("forms_form_read: not found"));
    show(client, read);
    await userEvent.click(await screen.findByRole("button", { name: /New form/ }));
    expect(await screen.findByText("That form is no longer there.")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/");
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(client.markRead).toHaveBeenCalledWith(["n1"]);
  });

  it("opens a form that is still there", async () => {
    const client = fake([note({})]);
    const read: Reader = vi.fn().mockResolvedValue({ id: "f1" });
    show(client, read);
    await userEvent.click(await screen.findByRole("button", { name: /New form/ }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).not.toBe("/"));
    expect(screen.queryByText("That form is no longer there.")).toBeNull();
  });
});
