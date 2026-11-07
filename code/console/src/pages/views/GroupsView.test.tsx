import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pages } from "../../data/registry";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, proposals, renderView } from "../spec/usersTesting";
import { GroupsView } from "./GroupsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const year = new Date().getFullYear();

const roster = (args: Record<string, unknown>) =>
  args.group_id === "g1" ? { items: [{ actor_id: "a1" }, { actor_id: "a2" }] } : { items: [] };

const hubWithGroups = {
  actor_list_groups: {
    items: [
      { id: "g1", name: "Riders", join_mode: "open", attributes: { ai_role: "r1" } },
      { id: "g2", name: "Customers", join_mode: "confirmed" },
      { id: "g3", name: "Odd ones", join_mode: "invite-only" },
    ],
  },
  actor_home_counts: { g1: 3, g2: 1 },
  agency_list_roles: { items: [{ id: "r1", name: "Dispatcher" }] },
  actor_list_actors: {
    items: [
      { id: "a1", display_name: "Otieno Odhiambo", created_at: `${year}-10-19T09:00:00Z` },
      { id: "a2", display_name: "Juma Onyango", created_at: `${year}-10-20T09:00:00Z` },
    ],
  },
  actor_list_actors_for_group: roster,
  actor_list_role_kinds: { items: [{ id: "k1", name: "Rider" }] },
  actor_list_role_holders: { items: [{ actor_id: "a1", group_id: "g1" }, { actor_id: "a2", group_id: "g1" }] },
};

const showGroups = (replies: Parameters<typeof answering>[0] = hubWithGroups, search = "") => {
  answering(replies);
  return renderView("groups", GroupsView, search);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

const bodyRows = () => screen.getAllByRole("row").slice(1);
const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));
const titles = () => Array.from(document.querySelectorAll(".card-toggle")).map((button) => button.textContent);
const opened = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name }));
  return within(screen.getByRole("button", { name }).closest(".card") as HTMLElement);
};

describe("the Groups page", () => {
  it("is titled Groups and offers Create a group", async () => {
    showGroups();

    expect(await screen.findByRole("heading", { level: 1, name: "Groups" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a group" })).toBeInTheDocument();
  });

  it("lists every group as a collapsed card with its member count, its join mode and its AI role inside", async () => {
    showGroups();

    await screen.findByText("Riders");

    expect(cards()).toHaveLength(3);
    const riders = await opened("Riders");
    expect(riders.getByText("Members").nextElementSibling).toHaveTextContent("3");
    expect(riders.getByText("Open")).toHaveClass("tag", "use");
    expect(riders.getByText("Dispatcher")).toHaveClass("tag", "mute");
    expect((await opened("Customers")).getByText("Approval needed")).toHaveClass("tag", "warn");
  });

  it("links the AI role to the Agents page", async () => {
    showGroups();

    await screen.findByText("Riders");

    expect((await opened("Riders")).getByText("Dispatcher").closest("a")).toHaveAttribute("href", "/h/h1/agents");
  });

  it("shows a dash for a group without an AI role", async () => {
    showGroups();

    await screen.findByText("Riders");

    expect((await opened("Customers")).getByText("AI role").nextElementSibling).toHaveTextContent("—");
  });

  it("shows a join mode it has no word for as the tool stores it", async () => {
    showGroups();

    await screen.findByText("Riders");

    expect((await opened("Odd ones")).getByText("invite-only")).toHaveClass("tag", "mute");
  });

  it("links every group to its own page with Edit", async () => {
    showGroups();

    await screen.findByText("Riders");

    expect(within(cards()[2]).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/groups?open=g1");
    expect(within(cards()[0]).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/groups?open=g2");
  });

  it("lists the groups in the order of their names", async () => {
    showGroups();
    await screen.findByText("Riders");

    expect(titles()).toEqual(["Customers", "Odd ones", "Riders"]);
  });

  it("keeps the groups whose name has the words typed", async () => {
    showGroups();
    const user = userEvent.setup();
    await screen.findByText("Riders");

    await user.type(screen.getByRole("searchbox", { name: "Search groups" }), "ride");

    expect(titles()).toEqual(["Riders"]);
  });

  it("offers no join mode button on the list", async () => {
    showGroups();

    await screen.findByText("Riders");

    expect(screen.queryByRole("button", { name: /join mode|approval|anyone/i })).not.toBeInTheDocument();
  });

  it("says there is nothing yet and keeps the title and the create button when the hub has no group", async () => {
    showGroups({});

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a group" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says the page could not be loaded in the error style and keeps the create button when a tool fails", async () => {
    showGroups({ ...hubWithGroups, actor_list_groups: new McpError("actor_list_groups: down") });

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("button", { name: "Create a group" })).toBeInTheDocument();
  });
});

describe("one group open", () => {
  it("is titled by the group and shows a Group card with the people in it, its join mode and its AI role", async () => {
    showGroups(hubWithGroups, "?open=g1");

    expect(await screen.findByRole("heading", { level: 1, name: "Riders" })).toBeInTheDocument();
    const card = (await screen.findByRole("heading", { name: "Group" })).closest("section") as HTMLElement;
    await waitFor(() => expect(within(card).getByText("Members").nextElementSibling).toHaveTextContent("2"));
    expect(within(card).getByText("Join mode").nextElementSibling).toHaveTextContent("Open");
    expect(within(card).getByText("AI role").nextElementSibling).toHaveTextContent("Dispatcher");
  });

  it("lists the members by name with their role and when they joined", async () => {
    showGroups(hubWithGroups, "?open=g1");

    await screen.findByText("Otieno Odhiambo");

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Member", "Role", "Joined", ""]);
    const first = within(bodyRows()[0]).getAllByRole("cell");
    expect(first[0]).toHaveTextContent("Otieno Odhiambo");
    expect(first[1]).toHaveTextContent("Rider");
    expect(first[2]).toHaveTextContent("19 Oct");
    expect(callsTo("actor_list_actors_for_group").some((args) => args.group_id === "g1")).toBe(true);
  });

  it("reads the open group itself and shows the join mode the group tool stores", async () => {
    showGroups({ ...hubWithGroups, actor_get_group: { id: "g1", name: "Riders", join_mode: "confirmed" } }, "?open=g1");

    const card = (await screen.findByRole("heading", { name: "Group" })).closest("section") as HTMLElement;
    await waitFor(() => expect(within(card).getByText("Join mode").nextElementSibling).toHaveTextContent("Approval needed"));
    expect(new Set(callsTo("actor_get_group").map((args) => JSON.stringify(args)))).toEqual(new Set([JSON.stringify({ group_id: "g1" })]));
  });

  it("keeps the join mode of the list when the group tool cannot be read", async () => {
    showGroups({ ...hubWithGroups, actor_get_group: new McpError("actor_get_group: down") }, "?open=g1");

    const card = (await screen.findByRole("heading", { name: "Group" })).closest("section") as HTMLElement;
    await waitFor(() => expect(within(card).getByText("Members").nextElementSibling).toHaveTextContent("2"));
    expect(within(card).getByText("Join mode").nextElementSibling).toHaveTextContent("Open");
  });

  it("offers no create button and a quiet Change join mode button", async () => {
    showGroups(hubWithGroups, "?open=g1");

    expect(await screen.findByRole("button", { name: "Change join mode" })).toHaveClass("quiet");
    expect(screen.queryByRole("button", { name: "Create a group" })).not.toBeInTheDocument();
  });

  it("says there is nothing here for a group the hub does not have", async () => {
    showGroups(hubWithGroups, "?open=nowhere");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Groups" })).toBeInTheDocument();
  });

  it("says the members could not be loaded in the error style while keeping the card", async () => {
    showGroups({ ...hubWithGroups, actor_list_actors: new McpError("actor_list_actors: down") }, "?open=g1");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("button", { name: "Change join mode" })).toBeInTheDocument();
  });
});

describe("changing how people join a group", () => {
  const openForm = async (search: string) => {
    showGroups(hubWithGroups, search);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change join mode" }));
    await screen.findByText("actor_set_group_join_mode");
    return user;
  };

  it("opens a form object for the join mode tool offering Open and Approval needed", async () => {
    await openForm("?open=g1");

    expect(screen.getByRole("radio", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Approval needed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("proposes approval for an open group by its id, name and stored mode, and says it waits for approval", async () => {
    const user = await openForm("?open=g1");

    await user.click(screen.getByRole("radio", { name: "Approval needed" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(proposals()).toEqual([
      { kind: "actor_set_group_join_mode", summary: "Make the Riders group approval required", payload: { group_id: "g1", join_mode: "confirmed" } },
    ]);
    expect(screen.queryByText("actor_set_group_join_mode")).not.toBeInTheDocument();
  });

  it("proposes opening a group that needs approval", async () => {
    const user = await openForm("?open=g2");

    await user.click(screen.getByRole("radio", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Waiting for approval");
    expect(proposals()).toEqual([
      { kind: "actor_set_group_join_mode", summary: "Make the Customers group open to anyone", payload: { group_id: "g2", join_mode: "open" } },
    ]);
  });

  it("recognises an open group by what the tool stores, not by the word shown", async () => {
    showGroups({ ...hubWithGroups, actor_list_groups: { items: [{ id: "g1", name: "Riders", join_mode: "open" }] } }, "?open=g1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change join mode" }));

    await user.click(await screen.findByRole("radio", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The group already works this way.");
    expect(proposals()).toEqual([]);
  });

  it("asks for a choice before it proposes anything", async () => {
    const user = await openForm("?open=g1");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required");
    expect(proposals()).toEqual([]);
  });

  it("says the change could not be sent and keeps the form when the proposal is refused", async () => {
    showGroups({ ...hubWithGroups, agency_propose_write: new McpError("agency_propose_write: boom") }, "?open=g1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change join mode" }));
    await user.click(await screen.findByRole("radio", { name: "Approval needed" }));

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
    expect(screen.getByText("actor_set_group_join_mode")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });

  it("sends one proposal however many times the button is pressed while it is on its way", async () => {
    let release: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    showGroups({
      ...hubWithGroups,
      agency_propose_write: async () => {
        await answered;
        return { id: "ap-1" };
      },
    }, "?open=g1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change join mode" }));
    await user.click(await screen.findByRole("radio", { name: "Approval needed" }));
    const submit = screen.getByRole("button", { name: "Submit" });

    await user.click(submit);
    await user.click(submit);

    expect(submit).toBeDisabled();
    release();
    await screen.findByText("Waiting for approval");
    expect(proposals()).toHaveLength(1);
  });

  it("closes without proposing anything when cancelled", async () => {
    const user = await openForm("?open=g1");
    await user.click(screen.getByRole("radio", { name: "Approval needed" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("actor_set_group_join_mode")).not.toBeInTheDocument();
    expect(proposals()).toEqual([]);
  });

  it("lists the groups again when the change was made at once, saying nothing", async () => {
    const original = pages.groups;
    const joinMode = vi.fn(async () => "done" as const);
    pages.groups = { ...original, actions: { joinMode } };
    try {
      const user = await openForm("?open=g1");
      const before = callsTo("actor_list_groups").length;

      await user.click(screen.getByRole("radio", { name: "Approval needed" }));
      await user.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(callsTo("actor_list_groups").length).toBeGreaterThan(before));
      expect(joinMode).toHaveBeenCalledWith("h1", { id: "g1", group_name: "Riders", join_mode: "confirmed" });
      expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
    } finally {
      pages.groups = original;
    }
  });
});

describe("creating a group", () => {
  const openForm = async () => {
    showGroups();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Create a group" }));
    await screen.findByText("actor_create_group");
    return user;
  };

  it("opens a form object for the group creation tool with a name to give", async () => {
    await openForm();

    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("proposes the group under the name given, says it waits for approval and closes the form", async () => {
    const user = await openForm();

    await user.type(screen.getByLabelText("Name *"), "  Farmers ");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(proposals()).toEqual([{ kind: "actor_create_group", summary: "Create the group Farmers", payload: { name: "Farmers" } }]);
    expect(screen.queryByText("actor_create_group")).not.toBeInTheDocument();
  });

  it("asks for the name and proposes nothing when it is left empty", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required");
    expect(proposals()).toEqual([]);
  });

  it("says the change could not be sent and keeps the name when the proposal is refused", async () => {
    showGroups({ ...hubWithGroups, agency_propose_write: new McpError("agency_propose_write: boom") });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Create a group" }));
    await user.type(await screen.findByLabelText("Name *"), "Farmers");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
    expect(screen.getByLabelText("Name *")).toHaveValue("Farmers");
  });

  it("closes without proposing anything when cancelled", async () => {
    const user = await openForm();
    await user.type(screen.getByLabelText("Name *"), "Farmers");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("actor_create_group")).not.toBeInTheDocument();
    expect(proposals()).toEqual([]);
  });
});
