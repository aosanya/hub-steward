import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { StartClient } from "../coordinator/start/api";
import { NotificationsPage } from "../pages/NotificationsPage";
import type { InboxClient } from "./api";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const quietStart = { waiting: async () => [] } as unknown as StartClient;

const client = (acceptInvitation: InboxClient["acceptInvitation"]): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  markRead: vi.fn().mockResolvedValue(0),
  listInvitations: vi.fn().mockResolvedValue([{ id: "i1", groupName: "Supplier", inviterName: "Grace Adhiambo", expiresInDays: 5 }]),
  acceptInvitation,
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

describe("an invitation while Join is on its way", () => {
  it("disables Join and Decline and asks the server once", async () => {
    const accept = vi.fn(() => new Promise<void>(() => undefined));
    const inbox = client(accept);
    render(
      <MemoryRouter>
        <NotificationsPage client={inbox} start={quietStart} />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText("You are invited to Supplier"));
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByRole("button", { name: "Joining" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
    expect(accept).toHaveBeenCalledTimes(1);
    expect(inbox.declineInvitation).not.toHaveBeenCalled();
  });
});
