import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, proposals, renderView } from "../spec/usersTesting";
import { UsersView } from "./UsersView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const year = new Date().getFullYear();

const roster = (args: Record<string, unknown>) =>
  args.group_id === "g1" ? { items: [{ actor_id: "a1" }, { actor_id: "a2" }] } : { items: [{ actor_id: "a3" }, { actor_id: "a1" }] };

const hubWithPeople = {
  actor_list_actors: {
    items: [
      { id: "a1", display_name: "Amina Otieno", public_code: "M-AAA-111", created_at: `${year}-10-26T09:00:00Z` },
      { id: "a2", display_name: "Brian Ochieng", created_at: `${year}-10-22T09:00:00Z` },
      { id: "a3", display_name: "", public_code: "M-ZYS-ATE-J57", created_at: `${year}-10-12T09:00:00Z` },
    ],
  },
  actor_list_groups: { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Supplier" }] },
  actor_list_actors_for_group: roster,
  actor_list_role_kinds: { items: [{ id: "k1", name: "Farmer" }, { id: "k2", name: "Buyer" }] },
  actor_list_role_holders: (args: Record<string, unknown>) => (args.kind_id === "k1" ? { items: [{ actor_id: "a1" }, { actor_id: "a2" }] } : { items: [] }),
  actor_list_groups_for_actor: { items: [{ group_id: "g1" }, { group_id: "g2" }] },
};

const showUsers = (replies: Parameters<typeof answering>[0] = hubWithPeople, search = "") => {
  answering(replies);
  return renderView("users", UsersView, search);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

const cardOf = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name }));
  return within(cards().find((card) => within(card).queryByRole("button", { name })) as HTMLElement);
};

const cardNames = () => cards().map((card) => within(card).getByRole("button").textContent);

describe("the Users page", () => {
  it("is titled Users and offers Invite a user", async () => {
    showUsers();

    expect(await screen.findByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite a user" })).toBeInTheDocument();
  });

  it("lists the people in the order of their names", async () => {
    const reversed = { ...hubWithPeople, actor_list_actors: { items: [...hubWithPeople.actor_list_actors.items].reverse() } };
    showUsers(reversed);

    await screen.findByText("Amina Otieno");

    expect(cardNames()).toEqual(["Amina Otieno", "Brian Ochieng", "M-ZYS-ATE-J57"]);
  });

  it("lists one line per person with the name, the role and when they joined", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");

    expect(cards()).toHaveLength(3);
    const amina = await cardOf("Amina Otieno");
    expect(amina.getByText("Farmer")).toHaveClass("tag", "mute");
    expect(amina.getByText("Joined").nextElementSibling).toHaveTextContent("26 Oct");
  });

  it("names Role, Groups and Joined inside an opened card", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");
    const amina = await cardOf("Amina Otieno");

    expect(["Role", "Groups", "Joined", "Member code"].map((term) => amina.getByText(term).textContent)).toEqual(["Role", "Groups", "Joined", "Member code"]);
    expect(await amina.findByText("Siaya farmers")).toHaveClass("tag");
    expect(amina.getByText("Supplier")).toHaveClass("tag");
  });

  it("keeps every card closed until its heading is pressed", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");

    expect(screen.queryByText("Joined")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Amina Otieno|Brian Ochieng|M-ZYS-ATE-J57/ })).toHaveLength(3);
  });

  it("shows a dash for a person who holds no role", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");

    const code = await cardOf("M-ZYS-ATE-J57");
    expect(code.getByText("Role").nextElementSibling).toHaveTextContent("—");
  });

  it("shows the member code for a person who has no name yet", async () => {
    showUsers();

    expect(await screen.findByRole("button", { name: "M-ZYS-ATE-J57" })).toBeInTheDocument();
  });

  it("writes a date of another year with its year", async () => {
    showUsers({ ...hubWithPeople, actor_list_actors: { items: [{ id: "a1", display_name: "Old Hand", created_at: "2019-03-02T12:00:00Z" }] } });

    await screen.findByText("Old Hand");

    const old = await cardOf("Old Hand");
    expect(old.getByText("2 Mar 2019")).toBeInTheDocument();
  });

  it("links every line to the person's own page", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");
    expect(within(cards()[0]).getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/h/h1/users?open=a1");
  });

  it("links a role to the Roles page", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");

    const amina = await cardOf("Amina Otieno");
    expect(amina.getByText("Farmer").closest("a")).toHaveAttribute("href", "/h/h1/roles");
  });

  it("says there is nothing yet and keeps the title and the invite button when nobody is in the hub", async () => {
    showUsers({});

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite a user" })).toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it("says the page could not be loaded in the error style and keeps the invite button when a tool fails", async () => {
    showUsers({ ...hubWithPeople, actor_list_actors: new McpError("actor_list_actors: down") });

    const failed = await screen.findByText("The page could not be loaded.");

    expect(failed).toHaveClass("error");
    expect(screen.getByRole("button", { name: "Invite a user" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("asks the hub for its people once, with the groups and roles to name them", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");

    expect(callsTo("actor_list_actors")).toHaveLength(1);
    expect(callsTo("actor_list_groups")).toHaveLength(1);
    expect(callsTo("actor_list_role_kinds")).toHaveLength(1);
  });
});

describe("narrowing the users", () => {
  it("offers a search box and a role filter above the cards", async () => {
    showUsers();

    await screen.findByText("Amina Otieno");

    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "All roles" })).toBeInTheDocument();
  });

  it("keeps the people whose name has what was typed, whatever the case, without asking the tools again", async () => {
    showUsers();
    const user = userEvent.setup();
    await screen.findByText("Amina Otieno");
    const asked = callsTo("actor_list_actors").length;

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "BRI");

    expect(screen.queryByText("Amina Otieno")).not.toBeInTheDocument();
    expect(screen.getByText("Brian Ochieng")).toBeInTheDocument();
    expect(callsTo("actor_list_actors")).toHaveLength(asked);
  });

  it("lists the roles that people hold under All roles and keeps the people who hold the one picked", async () => {
    showUsers();
    const user = userEvent.setup();
    await screen.findByText("Amina Otieno");

    const roles = screen.getByRole("combobox", { name: "All roles" });
    expect(within(roles).getAllByRole("option").map((option) => option.textContent)).toEqual(["All roles", "Farmer", "Buyer"]);
    await user.selectOptions(roles, "Farmer");

    expect(cards()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "M-ZYS-ATE-J57" })).not.toBeInTheDocument();
  });

  it("says there is nothing yet when nobody matches the search", async () => {
    showUsers();
    const user = userEvent.setup();
    await screen.findByText("Amina Otieno");

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "zzz");

    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
  });
});

describe("one user open", () => {
  it("is titled by the person's name and shows a Profile card with the role, groups, joined date and member code", async () => {
    showUsers(hubWithPeople, "?open=a1");

    expect(await screen.findByRole("heading", { level: 1, name: "Amina Otieno" })).toBeInTheDocument();
    const profile = screen.getByRole("heading", { name: "Profile" }).closest("section") as HTMLElement;
    expect(within(profile).getByText("Role").nextElementSibling).toHaveTextContent("Farmer");
    await within(profile).findByText("Supplier");
    expect(within(profile).getByText("Groups").nextElementSibling).toHaveTextContent("Siaya farmers Supplier");
    expect(within(profile).getByText("Joined").nextElementSibling).toHaveTextContent("26 Oct");
    expect(within(profile).getByText("Member code").nextElementSibling).toHaveTextContent("M-AAA-111");
  });

  it("offers no invite button and no filters", async () => {
    showUsers(hubWithPeople, "?open=a1");

    await screen.findByRole("heading", { level: 1, name: "Amina Otieno" });

    expect(screen.queryByRole("button", { name: "Invite a user" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("is titled by the member code for a person without a name", async () => {
    showUsers(hubWithPeople, "?open=a3");

    expect(await screen.findByRole("heading", { level: 1, name: "M-ZYS-ATE-J57" })).toBeInTheDocument();
  });

  it("leaves out the member code line for a person who has none", async () => {
    showUsers(hubWithPeople, "?open=a2");

    await screen.findByRole("heading", { level: 1, name: "Brian Ochieng" });

    expect(screen.queryByText("Member code")).not.toBeInTheDocument();
  });

  it("says there is nothing here for a person the hub does not have", async () => {
    showUsers(hubWithPeople, "?open=nobody");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
  });

  it("says the page could not be loaded when the people cannot be read", async () => {
    showUsers({ ...hubWithPeople, actor_list_actors: new McpError("actor_list_actors: down") }, "?open=a1");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
  });
});

describe("inviting a user", () => {
  const openForm = async () => {
    const user = userEvent.setup();
    await screen.findByText("Amina Otieno");
    await user.click(screen.getByRole("button", { name: "Invite a user" }));
    await screen.findByLabelText(/Group/);
    return user;
  };

  it("opens a form object for the invitation tool with the group, member code, person and name", async () => {
    showUsers();
    await openForm();

    expect(screen.getByText("actor_invite_to_group")).toHaveClass("form-tool");
    expect(screen.getByLabelText("Group *")).toBeInTheDocument();
    expect(screen.getByLabelText("Member code")).toBeInTheDocument();
    expect(screen.getByLabelText("Person")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("offers the groups of the hub by name", async () => {
    showUsers();
    await openForm();

    const groups = screen.getByLabelText("Group *");

    expect(within(groups).getAllByRole("option").map((option) => option.textContent)).toEqual(["Siaya farmers", "Supplier"]);
  });

  it("proposes the invitation under the person's name and the group's name, then says it waits for approval and closes the form", async () => {
    showUsers();
    const user = await openForm();

    await user.selectOptions(screen.getByLabelText("Group *"), "Supplier");
    await user.type(screen.getByLabelText("Person"), "a-9");
    await user.type(screen.getByLabelText("Name"), "Amina");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveClass("error");
    expect(proposals()).toEqual([{ kind: "actor_invite_to_group", summary: "Invite Amina to Supplier", payload: { actor_id: "a-9", group_id: "g2" } }]);
    expect(screen.queryByText("actor_invite_to_group")).not.toBeInTheDocument();
  });

  it("invites into the first group when none is picked", async () => {
    showUsers();
    const user = await openForm();

    await user.type(screen.getByLabelText("Person"), "a-9");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Waiting for approval");
    expect(proposals()[0].payload).toEqual({ actor_id: "a-9", group_id: "g1" });
    expect(proposals()[0].summary).toBe("Invite a-9 to Siaya farmers");
  });

  it("invites by member code under the screen name the code belongs to", async () => {
    showUsers({ ...hubWithPeople, actor_get_screen_name_by_code: { display_name: "Amina K" } });
    const user = await openForm();

    await user.type(screen.getByLabelText("Member code"), "M-K7P-4QX-M2T");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Waiting for approval");
    expect(proposals()).toEqual([
      { kind: "actor_invite_to_group", summary: "Invite Amina K to Siaya farmers", payload: { actor_code: "M-K7P-4QX-M2T", group_id: "g1" } },
    ]);
  });

  it("asks for one of a member code and a person, and proposes nothing when both or neither are given", async () => {
    showUsers();
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Give a member code or a person, one of the two.");

    await user.type(screen.getByLabelText("Member code"), "M-1");
    await user.type(screen.getByLabelText("Person"), "a-1");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Give a member code or a person, one of the two.");
    expect(proposals()).toEqual([]);
    expect(screen.getByText("actor_invite_to_group")).toBeInTheDocument();
  });

  it("says the change could not be sent and keeps the form and what was typed when the invitation is refused", async () => {
    showUsers({ ...hubWithPeople, agency_propose_write: new McpError("agency_propose_write: boom") });
    const user = await openForm();

    await user.type(screen.getByLabelText("Person"), "a-9");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
    expect(screen.getByLabelText("Person")).toHaveValue("a-9");
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });

  it("can be sent again after a failure", async () => {
    let answers = 0;
    showUsers({
      ...hubWithPeople,
      agency_propose_write: () => {
        if (++answers === 1) throw new McpError("agency_propose_write: boom");
        return { id: "ap-1" };
      },
    });
    const user = await openForm();
    await user.type(screen.getByLabelText("Person"), "a-9");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("The change could not be sent.");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
  });

  it("closes without proposing anything when cancelled", async () => {
    showUsers();
    const user = await openForm();
    await user.type(screen.getByLabelText("Person"), "a-9");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("actor_invite_to_group")).not.toBeInTheDocument();
    expect(proposals()).toEqual([]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("clears the earlier note when the form is opened again", async () => {
    showUsers();
    const user = await openForm();
    await user.type(screen.getByLabelText("Person"), "a-9");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Waiting for approval");

    await user.click(screen.getByRole("button", { name: "Invite a user" }));

    await waitFor(() => expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument());
    expect(screen.getByText("actor_invite_to_group")).toBeInTheDocument();
  });
});
