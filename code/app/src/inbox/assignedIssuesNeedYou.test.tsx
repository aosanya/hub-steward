import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { StartClient } from "../coordinator/start/api";
import { NotificationsPage } from "../pages/NotificationsPage";
import type { InboxClient, NotificationItem } from "./api";
import type { AssignedClient } from "./assignedIssues";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const issue = { id: "t1", code: "HS-002", title: "Review: the Review step", step: "review" };

const announcement: NotificationItem = { id: "a1", event: "task_assigned", subjectKind: "issue", subjectId: "t1", names: {}, createdAt: "2026-11-12T10:00:00Z", read: false };

const news: NotificationItem = { id: "n1", event: "results_published", subjectKind: "", subjectId: "", names: {}, createdAt: "2026-11-12T09:00:00Z", read: false };

const inboxOf = (notes: NotificationItem[]): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const startOf = () => ({ waiting: vi.fn().mockResolvedValue([]) }) as unknown as StartClient;

const assignedOf = (...issues: (typeof issue)[]): AssignedClient => ({ assigned: vi.fn().mockResolvedValue(issues) });

describe("an assigned issue on the Notifications page", () => {
  it("is listed under Needs you by code and title, once, beside the news under Updates", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage client={inboxOf([announcement, news])} start={startOf()} assigned={assignedOf(issue)} />
      </MemoryRouter>,
    );
    const needs = (await screen.findByRole("heading", { level: 2, name: "Needs you" })).nextElementSibling as HTMLElement;
    expect(within(needs).getByText("HS-002 Review: the Review step")).toBeInTheDocument();
    expect(within(needs).queryByText("An issue was assigned to you")).toBeNull();
    expect(screen.queryAllByText("An issue was assigned to you")).toHaveLength(0);
  });

  it("is the only thing that waits, so the page is not all caught up", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage client={inboxOf([])} start={startOf()} assigned={assignedOf(issue)} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("HS-002 Review: the Review step")).toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("keeps the announcement when the issues cannot be read, so the thing is not lost", async () => {
    const down: AssignedClient = { assigned: vi.fn().mockRejectedValue(new Error("down")) };
    render(
      <MemoryRouter>
        <NotificationsPage client={inboxOf([announcement])} start={startOf()} assigned={down} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("An issue was assigned to you")).toBeInTheDocument();
  });
});
