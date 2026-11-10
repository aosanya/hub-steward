import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { UsersPage } from "./usersPage";
import { clearPages, clearShown, installPage, renderSpec, answering as answeringPage } from "./specHarness.test-helper";
import { answering, callsTo } from "./usersFixtures.test-helper";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const people = [
  { actor_id: "a1", display_name: "Wanjiru Kamau", public_code: "WK1", created_at: "2026-10-01T09:00:00Z" },
  { actor_id: "a2", display_name: "Amina Otieno", public_code: "AO2", created_at: "2025-03-04T09:00:00Z" },
  { actor_id: "a3", display_name: "Brian Ochieng", public_code: "BO3", created_at: "2026-10-20T09:00:00Z" },
];

const hub = {
  actor_list_groups: { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Boda riders" }] },
  actor_list_actors: { items: people },
  actor_list_actors_for_group: (args: Record<string, unknown>) => ({ items: args.group_id === "g1" ? [people[0], people[1]] : [people[2]] }),
  actor_list_role_kinds: { items: [{ id: "k1", name: "Coordinator" }, { id: "k2", name: "Member" }] },
  actor_list_role_holders: (args: Record<string, unknown>) => ({ items: args.kind_id === "k1" ? [{ actor_id: "a1", group_id: "g1" }] : [] }),
  actor_list_join_requests_for_group: { items: [] },
};

beforeEach(() => {
  clearPages();
  clearShown();
  vi.mocked(callTool).mockReset();
});

const open = (route = "/") => renderSpec(<UsersPage hubId="h1" />, route);

describe("the Users page list", () => {
  it("lists the people by name, oldest letters first, with a button to invite one", async () => {
    answering(hub);
    open();

    await screen.findByText("Amina Otieno");
    const names = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(names.indexOf("Amina Otieno")).toBeLessThan(names.indexOf("Brian Ochieng"));
    expect(names.indexOf("Brian Ochieng")).toBeLessThan(names.indexOf("Wanjiru Kamau"));
    expect(screen.getByRole("button", { name: "Invite a user" })).toBeInTheDocument();
  });

  it("narrows the list to the search words", async () => {
    answering(hub);
    open();
    await screen.findByText("Amina Otieno");

    await userEvent.type(screen.getByPlaceholderText("Search users"), "brian");

    expect(screen.getByText("Brian Ochieng")).toBeInTheDocument();
    expect(screen.queryByText("Amina Otieno")).not.toBeInTheDocument();
  });

  it("narrows the list to the people who hold the chosen role", async () => {
    answering(hub);
    open();
    await screen.findByText("Amina Otieno");

    await userEvent.selectOptions(screen.getByRole("combobox"), "Coordinator");

    expect(screen.getByText("Wanjiru Kamau")).toBeInTheDocument();
    expect(screen.queryByText("Amina Otieno")).not.toBeInTheDocument();
    expect(screen.queryByText("Brian Ochieng")).not.toBeInTheDocument();
  });

  it("offers every role the hub has, held or not", async () => {
    answering(hub);
    open();
    await screen.findByText("Amina Otieno");

    const roles = within(screen.getByRole("combobox")).getAllByRole("option").map((option) => option.textContent);
    expect(roles).toEqual(["All roles", "Coordinator", "Member"]);
  });

  it("says nothing is here when the search matches nobody", async () => {
    answering(hub);
    open();
    await screen.findByText("Amina Otieno");

    await userEvent.type(screen.getByPlaceholderText("Search users"), "zzz");

    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the hub refuses the list", async () => {
    answering({ ...hub, actor_list_groups: new Error("down") });
    open();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("Amina Otieno")).not.toBeInTheDocument();
  });

  it("shows the list of people with no roles when the role kinds cannot be read", async () => {
    answering({ ...hub, actor_list_role_kinds: new Error("forbidden") });
    open();

    expect(await screen.findByText("Amina Otieno")).toBeInTheDocument();
    expect(within(screen.getByRole("combobox")).getAllByRole("option")).toHaveLength(1);
  });
});

describe("the people waiting to join", () => {
  it("lists each request with its group and the decision buttons", async () => {
    answering({
      ...hub,
      actor_list_join_requests_for_group: (args: Record<string, unknown>) => ({
        items: args.group_id === "g2" ? [{ id: "r1", actor_id: "a3", state: "pending" }, { id: "r2", actor_id: "a1", state: "approved" }] : [],
      }),
    });
    open();

    const waiting = await screen.findByRole("region", { name: "Waiting for approval" });
    expect(within(waiting).getByText("Brian Ochieng")).toBeInTheDocument();
    expect(within(waiting).getByText("Boda riders")).toBeInTheDocument();
    expect(within(waiting).queryByText("Wanjiru Kamau")).not.toBeInTheDocument();
    expect(within(waiting).getAllByRole("button", { name: "Approve" })).toHaveLength(1);
    expect(callsTo("actor_list_join_requests_for_group").every((args) => args.pending_only === true)).toBe(true);
  });

  it("still lists the people and says the waiting list could not be read when it fails", async () => {
    answering({ ...hub, actor_list_join_requests_for_group: new Error("down") });
    open();

    expect(await screen.findByText("Amina Otieno")).toBeInTheDocument();
    expect(screen.getByText("The page could not be loaded.")).toBeInTheDocument();
  });
});

describe("one person opened", () => {
  const detail = {
    ...hub,
    actor_get_actor: { public_code: "AO2", created_at: "2025-03-04T09:00:00Z" },
    actor_list_groups_for_actor: { items: [{ group_id: "g1" }] },
    taskmanager_task_list: {
      items: [
        { id: "t1", title: "Count the seed bags", status: "doing", assigned_to: "a2", assignee_kind: "actor", due_at: "2026-12-01T00:00:00Z" },
        { id: "t2", title: "Someone else's job", status: "todo", assigned_to: "a1", assignee_kind: "actor" },
      ],
    },
    assetmanager_hold_list: { items: [{ id: "h1", quantity: 4, status: "active", placed_by: "a2", ends_at: "2026-12-02T10:00:00Z" }, { id: "h2", quantity: 9, placed_by: "a1" }] },
  };

  it("shows the person's name, member code, groups, own tasks and own holds only", async () => {
    answering(detail);
    open("/?open=a2");

    expect(await screen.findByText("Count the seed bags")).toBeInTheDocument();
    expect(screen.getAllByText("Amina Otieno").length).toBeGreaterThan(0);
    expect(screen.getByText("AO2")).toBeInTheDocument();
    expect(screen.getByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.queryByText("Someone else's job")).not.toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("9")).not.toBeInTheDocument();
  });

  it("says nothing is here for a person who is not on the hub's list", async () => {
    answering(detail);
    open("/?open=ghost");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite a user" })).not.toBeInTheDocument();
  });

  it("says the person's details could not be loaded when the hub refuses them, keeping what the list had", async () => {
    answering({ ...detail, actor_get_actor: new Error("down") });
    open("/?open=a2");

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("Siaya farmers")).toBeInTheDocument();
  });

  it("says no tasks and no holds when the person has none", async () => {
    answering({ ...detail, taskmanager_task_list: { items: [] }, assetmanager_hold_list: { items: [] } });
    open("/?open=a2");

    expect(await screen.findByText("No tasks handed to this person.")).toBeInTheDocument();
    expect(screen.getByText("This person has no holds.")).toBeInTheDocument();
  });
});

describe("inviting a person", () => {
  const withActions = (action: ReturnType<typeof answeringPage>) => {
    installPage("groups", { rows: [{ id: "g1", group: "Siaya farmers" }, { id: "g2", group: "Boda riders" }] });
    installPage("users", { actions: { users: action } });
  };

  const openForm = async () => {
    answering(hub);
    open();
    await screen.findByText("Amina Otieno");
    await userEvent.click(screen.getByRole("button", { name: "Invite a user" }));
    await screen.findByLabelText("Member code");
  };

  it("asks for one of a member code or a person id, not none and not both", async () => {
    const send = answeringPage("done");
    withActions(send);
    await openForm();
    await userEvent.selectOptions(screen.getByLabelText("Group *"), "Siaya farmers");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText(/one of the two/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Member code"), "WK1");
    await userEvent.type(screen.getByLabelText("Person"), "a9");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/one of the two/)).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the group's name with the invitation, and refreshes the list when it is done", async () => {
    const send = answeringPage("done");
    withActions(send);
    await openForm();
    const before = callsTo("actor_list_actors").length;

    await userEvent.selectOptions(screen.getByLabelText("Group *"), "Boda riders");
    await userEvent.type(screen.getByLabelText("Member code"), "WK1");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][1]).toMatchObject({ group_id: "g2", group_name: "Boda riders", actor_code: "WK1" });
    await waitFor(() => expect(callsTo("actor_list_actors").length).toBeGreaterThan(before));
    expect(screen.queryByLabelText("Member code")).not.toBeInTheDocument();
  });

  it("says the invitation is waiting for approval when the owner must approve it", async () => {
    withActions(answeringPage("accepted"));
    await openForm();

    await userEvent.selectOptions(screen.getByLabelText("Group *"), "Siaya farmers");
    await userEvent.type(screen.getByLabelText("Person"), "a9");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.queryByLabelText("Member code")).not.toBeInTheDocument();
  });

  it("keeps the form open and says the change could not be sent when the hub refuses", async () => {
    withActions(
      vi.fn(async () => {
        throw new Error("no such member");
      }),
    );
    await openForm();

    await userEvent.selectOptions(screen.getByLabelText("Group *"), "Siaya farmers");
    await userEvent.type(screen.getByLabelText("Member code"), "ZZ9");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Member code")).toHaveValue("ZZ9");
  });

  it("closes the form when Cancel is pressed", async () => {
    withActions(answeringPage("done"));
    await openForm();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Member code")).not.toBeInTheDocument();
  });
});
