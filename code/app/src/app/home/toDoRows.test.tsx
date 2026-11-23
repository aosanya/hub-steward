import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import type { StartClient, StartStep } from "../../features/market";
import type { InboxClient, InvitationItem, NotificationItem } from "../../features/inbox/api";
import type { AssignedClient } from "../../features/inbox/assignedIssues";
import { ToDoRows } from "./ToDoRows";

const step = (id: string): StartStep => ({ id, title: `Report ${id}`, formName: "Harvest report", roleName: "Farmer", workflowName: "", agencyName: "Alego", questions: [] });

const notice = (id: string, event: string): NotificationItem => ({ id, event, subjectKind: "form", subjectId: "f1", names: {}, createdAt: "2026-11-12T10:00:00Z", read: false });

const invitation: InvitationItem = { id: "i1", groupName: "Kisumu", inviterName: "Amina", expiresInDays: 3 };

type Setup = { steps?: StartStep[]; notes?: NotificationItem[]; invitations?: InvitationItem[]; issues?: { id: string; code: string; title: string; step: string }[]; stepsDown?: boolean };

let landed = "";

const Where = () => {
  const { pathname, hash } = useLocation();
  landed = `${pathname}${hash}`;
  return null;
};

const show = ({ steps = [], notes = [], invitations = [], issues = [], stepsDown = false }: Setup = {}) => {
  const inbox = { listNotifications: async () => notes, listInvitations: async () => invitations, markRead: async () => 0 } as unknown as InboxClient;
  const start = { waiting: stepsDown ? async () => Promise.reject(new Error("down")) : async () => steps } as unknown as StartClient;
  const assigned: AssignedClient = { assigned: async () => issues };
  return render(
    <MemoryRouter initialEntries={["/a/alego/my-work"]}>
      <ToDoRows inbox={inbox} start={start} assigned={assigned} />
      <Where />
    </MemoryRouter>,
  );
};

const titles = () => screen.getAllByRole("button").map((button) => button.querySelector(".ttl")?.textContent);

beforeEach(() => openAgency("alego"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

describe("the To do tab of My work", () => {
  it("lists the waiting steps, the assigned issues, the invitations and the waiting notices, the same things the count adds up", async () => {
    show({ steps: [step("s1")], issues: [{ id: "t1", code: "HS-2", title: "Review", step: "review" }], invitations: [invitation], notes: [notice("n1", "new_form")] });
    await screen.findByText("Report s1");
    await screen.findByText("You are invited to Kisumu");
    expect(titles()).toHaveLength(4);
  });

  it("leaves news that waits on no one to Notifications", async () => {
    show({ steps: [step("s1")], notes: [notice("n2", "results_published")] });
    await screen.findByText("Report s1");
    expect(titles()).toEqual(["Report s1"]);
  });

  it("says nothing is waiting, in a card, when nothing is", async () => {
    const { container } = show();
    await waitFor(() => expect(container.querySelector(".card.empty")).not.toBeNull());
    expect(screen.getByText("Nothing is waiting for you")).toBeInTheDocument();
  });

  it("says in Swahili and in Hungarian that nothing is waiting", async () => {
    window.localStorage.setItem("hub.language", "sw");
    const swahili = show();
    expect(await screen.findByText("Hakuna kinachokusubiri")).toBeInTheDocument();
    swahili.unmount();
    window.localStorage.setItem("hub.language", "hu");
    show();
    expect(await screen.findByText("Nem vár rád semmi")).toBeInTheDocument();
    window.localStorage.removeItem("hub.language");
  });

  it("opens an invitation on the Needs you part of Notifications, where it is answered", async () => {
    const user = userEvent.setup();
    show({ invitations: [invitation] });
    await user.click(await screen.findByRole("button", { name: /You are invited to Kisumu/ }));
    expect(landed).toBe("/a/alego/notifications#needs-you");
  });

  it("says the tasks could not be loaded, with Try again, when the steps cannot be read", async () => {
    show({ stepsDown: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your tasks could not be loaded.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing is waiting for you")).not.toBeInTheDocument();
  });
});
