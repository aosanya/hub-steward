import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { StartClient, StartStep } from "../coordinator/start/api";
import type { InboxClient, InvitationItem, NotificationItem } from "../inbox/api";
import { NeedsYouSection } from "../inbox/NeedsYouSection";
import { needsYouAnchor } from "../tabs";
import { NeedsYouStrip, NeedsYouStripRow } from "./NeedsYouStrip";

const note = (id: string, event: string, read = false): NotificationItem => ({
  id,
  event,
  subjectKind: "",
  subjectId: "",
  names: {},
  createdAt: "2026-11-12T10:00:00Z",
  read,
});

const step = (id: string): StartStep => ({ id, title: id, formName: "Harvest report", roleName: "", workflowName: "", agencyName: "", questions: [] });

const invitation = (id: string): InvitationItem => ({ id, groupName: "Kisumu", inviterName: "Amina", expiresInDays: 3 });

type Setup = { notes?: NotificationItem[]; invitations?: InvitationItem[]; steps?: StartStep[]; down?: boolean };

const inboxOf = ({ notes = [], invitations = [], down = false }: Setup): InboxClient => ({
  listNotifications: down ? vi.fn().mockRejectedValue(new Error("down")) : vi.fn().mockResolvedValue(notes),
  markRead: vi.fn().mockResolvedValue(0),
  listInvitations: vi.fn().mockResolvedValue(invitations),
  acceptInvitation: vi.fn().mockResolvedValue(undefined),
  declineInvitation: vi.fn().mockResolvedValue(undefined),
});

const startOf = ({ steps = [] }: Setup) => ({ waiting: vi.fn().mockResolvedValue(steps) }) as unknown as StartClient;

let landed = "";

const Where = () => {
  const { pathname, hash } = useLocation();
  landed = `${pathname}${hash}`;
  return null;
};

const inRouter = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={["/a/alego/home"]}>
      {ui}
      <Where />
    </MemoryRouter>,
  );

const showStrip = (setup: Setup = {}) => {
  const inbox = inboxOf(setup);
  inRouter(<NeedsYouStrip inbox={inbox} start={startOf(setup)} />);
  return inbox;
};

beforeEach(() => {
  openAgency("alego");
  landed = "";
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

describe("Needs you strip row", () => {
  it("says how many things there are to do, with a chevron", () => {
    inRouter(<NeedsYouStripRow count={3} />);
    const strip = screen.getByRole("button", { name: /You have 3 things to do/ });
    expect(strip.querySelector(".end")?.textContent).toBe("›");
  });

  it("says thing, not things, for one", () => {
    inRouter(<NeedsYouStripRow count={1} />);
    expect(screen.getByRole("button", { name: /You have 1 thing to do/ })).toBeTruthy();
  });

  it.each([0, null])("is hidden when the count is %s", (count) => {
    inRouter(<NeedsYouStripRow count={count} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/thing/)).toBeNull();
  });

  it("opens the Needs you section of the Notifications page of the open agency", async () => {
    const user = userEvent.setup();
    inRouter(<NeedsYouStripRow count={2} />);
    await user.click(screen.getByRole("button"));
    expect(landed).toBe("/a/alego/notifications#needs-you");
  });

  it("opens the section where the caller says", async () => {
    const user = userEvent.setup();
    inRouter(<NeedsYouStripRow count={2} to="/a/alego/elsewhere" />);
    await user.click(screen.getByRole("button"));
    expect(landed).toBe("/a/alego/elsewhere");
  });
});

describe("Needs you strip", () => {
  it("shows the Needs you count: steps, invitations and unread things waiting", async () => {
    showStrip({ steps: [step("s1")], invitations: [invitation("i1")], notes: [note("a", "ask_waiting"), note("b", "results_published")] });
    expect(await screen.findByRole("button", { name: /You have 3 things to do/ })).toBeTruthy();
  });

  it("shows no number before the reads have answered", async () => {
    showStrip({ steps: [step("s1")] });
    expect(screen.queryByText(/thing/)).toBeNull();
    await screen.findByText(/You have 1 thing to do/);
  });

  it("is hidden when nothing waits on the member, even with unread news", async () => {
    const inbox = showStrip({ notes: [note("n", "results_published")] });
    await waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(/thing/)).toBeNull();
  });

  it("shows no number, not 0, after a failed read", async () => {
    const inbox = showStrip({ steps: [step("s1")], down: true });
    await waitFor(() => expect(inbox.listNotifications).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(/thing/)).toBeNull();
    expect(screen.queryByText(/You have 0/)).toBeNull();
  });
});

describe("Needs you section anchor", () => {
  it("is the heading the strip opens, found by the anchor in the strip's address", () => {
    inRouter(<NeedsYouSection start={startOf({ steps: [step("s1")] })} invitations={[invitation("i1")]} notices={[]} state={{ loading: false, words: "" }} hasRows onRetry={() => undefined} onOpenInvitation={() => undefined} onOpenNotice={() => undefined} />);
    expect(document.getElementById(needsYouAnchor)?.textContent).toBe("Needs you");
  });
});
