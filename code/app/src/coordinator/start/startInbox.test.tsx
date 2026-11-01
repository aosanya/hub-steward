import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InboxPage } from "../../pages/InboxPage";
import * as mcp from "../../wakala/mcp";
import type { StartClient, StartStep } from "./api";
import { TabBar } from "../../ui/TabBar";

const rawStep = {
  id: "w1",
  title: "Start the urea group order",
  form_name: "Urea group order",
  role_name: "Group coordinator",
  kind: "fill_form",
  questions: [
    { prompt: "Product", answer_type: "free_text" },
    { prompt: "Price a bag", answer_type: "currency" },
    { prompt: "Minimum bags", answer_type: "number" },
  ],
};

const rawNote = (id: string) => ({ id, event: "new_form", subject_kind: "form", subject_id: "f1", names: {}, created_at: "2026-10-28T10:40:00Z", read_at: null });

const replies = (over: Record<string, unknown> = {}) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
    if (tool in over) return over[tool] as any;
    switch (tool) {
      case "agency_list_my_open_steps":
        return { items: [rawStep] };
      case "market_list_group_orders":
        return { items: [] };
      case "agency_get_agency":
        return { name: "Siaya Farmers' Group" };
      case "comm_notification_list":
        return { items: [] };
      case "comm_notification_mark_read":
        return { marked: 0 };
      case "actor_list_my_invitations":
        return { items: [] };
      default:
        throw new Error(`no answer for ${tool}`);
    }
  });

const openInbox = () =>
  render(
    <MemoryRouter>
      <InboxPage />
    </MemoryRouter>,
  );

const startRow = async () => (await screen.findByText("Start the urea group order")).closest(".row") as HTMLElement;

afterEach(() => vi.restoreAllMocks());

describe("a Start step in the Inbox, as the drawing shows it", () => {
  it("counts in the tab badge on its own", async () => {
    replies();
    openInbox();
    expect(await screen.findByLabelText("1 unread notifications")).toHaveTextContent("1");
  });

  it("shows the unread dot, the agency and the role, and no time", async () => {
    replies();
    openInbox();
    const row = await startRow();
    expect(row.firstElementChild).toBe(within(row).getByLabelText("Unread"));
    expect(within(row).getByText("Siaya Farmers' Group · Group coordinator")).toBeInTheDocument();
    expect(row.querySelector(".end")).toBeNull();
  });

  it("is not an empty Inbox", async () => {
    replies();
    openInbox();
    await startRow();
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });

  it("does not show Mark all read while only the Start row waits", async () => {
    const call = replies();
    openInbox();
    await startRow();
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
    expect(call).not.toHaveBeenCalledWith("", "comm_notification_mark_read", expect.anything());
    expect(screen.getByLabelText("1 unread notifications")).toBeInTheDocument();
  });

  it("shows Mark all read in the bar while a notification is unread beside the Start row", async () => {
    replies({ comm_notification_list: { items: [rawNote("n1")] } });
    openInbox();
    await startRow();
    const button = await screen.findByRole("button", { name: "Mark all read" });
    expect(button.closest("header.bar")).not.toBeNull();
  });

  it("counts with the unread notifications, and Mark all read leaves the Start row counted", async () => {
    const call = replies({ comm_notification_list: { items: [rawNote("n1"), rawNote("n2")] } });
    openInbox();
    expect(await screen.findByLabelText("3 unread notifications")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(call).toHaveBeenCalledWith("", "comm_notification_mark_read", { ids: ["n1", "n2"] });
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
  });

  it("sits in the same box as the notifications", async () => {
    replies({ comm_notification_list: { items: [rawNote("n1")] } });
    const { container } = openInbox();
    await startRow();
    await screen.findByText("New form");
    expect(container.querySelectorAll(".rows")).toHaveLength(1);
  });

  it("reads the steps once for the page and the tab together", async () => {
    const call = replies();
    openInbox();
    await startRow();
    expect(call.mock.calls.filter(([, tool]) => tool === "agency_list_my_open_steps")).toHaveLength(1);
  });

  it("leaves no row, no badge and no Mark all read when nothing waits and nothing is unread, and says all caught up", async () => {
    replies({ agency_list_my_open_steps: { items: [] } });
    openInbox();
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.queryByLabelText(/unread notifications/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  });

  it("counts only the steps that start a group order", async () => {
    replies({ agency_list_my_open_steps: { items: [rawStep, { id: "w2", title: "Notice", kind: "notify", questions: [] }] } });
    openInbox();
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
  });

  it("keeps the row and the badge while a live group order exists, since she can have several", async () => {
    replies({ market_list_group_orders: { items: [{ id: "g1", direction: "buy", state: "open" }] } });
    openInbox();
    await startRow();
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).toBeNull();
  });
});

describe("the tab bar counts a waiting Start step", () => {
  const step: StartStep = { id: "w1", title: "Start the urea group order", formName: "Urea group order", roleName: "Group coordinator", workflowName: "", agencyName: "Siaya Farmers' Group", questions: [] };
  const clientOf = (steps: StartStep[]) => ({ waiting: async () => steps }) as unknown as StartClient;
  const inbox = { listNotifications: async () => [] } as any;

  it("shows 1 for one waiting step and none for nothing", async () => {
    const first = render(
      <MemoryRouter>
        <TabBar inbox={inbox} start={clientOf([step])} />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
    first.unmount();
    render(
      <MemoryRouter>
        <TabBar inbox={inbox} start={clientOf([])} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByLabelText(/unread notifications/)).toBeNull());
  });
});
