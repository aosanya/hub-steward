import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { NotificationsPage } from "./NotificationsPage";
import type { InboxClient, NotificationItem } from "./api";
import type { StartClient } from "../market";
import type { Reader } from "./subjectCheck";

beforeEach(() => openAgency("town"));

afterEach(() => forgetOpenAgency());

const handedOver: NotificationItem = {
  id: "n1",
  event: "report_handed_over",
  subjectKind: "report",
  subjectId: "2026-04-01~2026-07-01",
  names: { name: "Second quarter", period: "2026-04-01 to 2026-06-30", planned: "8,000", spent: "8,300", difference: "-300" },
  createdAt: "2026-11-18T09:00:00Z",
  read: false,
};

const client = (notes: NotificationItem[]): InboxClient => ({
  listNotifications: vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(notes.length),
  listInvitations: vi.fn().mockResolvedValue([]),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const stillThere: Reader = async () => ({ status: "pending" });

const show = (notes: NotificationItem[]) =>
  render(
    <MemoryRouter>
      <NotificationsPage client={client(notes)} start={{ waiting: async () => [] } as unknown as StartClient} read={stillThere} />
    </MemoryRouter>,
  );

describe("a report handed to the caller", () => {
  it("reads as the report's name, with its period and figures as the line", async () => {
    show([handedOver]);

    expect(await screen.findByText("Report: Second quarter")).toBeInTheDocument();
    expect(screen.getByText("2026-04-01 to 2026-06-30 · Planned 8,000 · Spent 8,300 · Difference -300")).toBeInTheDocument();
  });

  it("reads as a report was handed over when the sender gave no name", async () => {
    show([{ ...handedOver, names: {} }]);

    expect(await screen.findByText("A report was handed to you")).toBeInTheDocument();
  });
});

describe("the list of who has not paid, handed to the caller", () => {
  const unpaid: NotificationItem = {
    id: "n2",
    event: "payment_list_handed_over",
    subjectKind: "report",
    subjectId: "unpaid",
    names: { total: "2,000 Ft", payers: "2", list: "Anna Sample\nCsilla Sample" },
    createdAt: "2026-11-19T09:00:00Z",
    read: false,
  };

  it("reads as an unpaid list with the total owed as the line", async () => {
    show([unpaid]);

    expect(await screen.findByText("The list of who has not paid was handed to you")).toBeInTheDocument();
    expect(screen.getByText("Owed in total: 2,000 Ft")).toBeInTheDocument();
  });

  it("still reads as an unpaid list when the sender gave no total", async () => {
    show([{ ...unpaid, names: {} }]);

    expect(await screen.findByText("The list of who has not paid was handed to you")).toBeInTheDocument();
  });
});
