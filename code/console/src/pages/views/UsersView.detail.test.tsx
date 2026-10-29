import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { UsersView } from "./UsersView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const year = new Date().getFullYear();

const people = {
  actor_list_actors: {
    items: [
      { id: "a1", display_name: "Amina Otieno", public_code: "M-AAA-111", created_at: `${year}-10-26T09:00:00Z` },
      { id: "a2", display_name: "Brian Ochieng", created_at: `${year}-10-22T09:00:00Z` },
    ],
  },
  actor_list_groups: { items: [{ id: "g1", name: "Siaya farmers" }, { id: "g2", name: "Supplier" }] },
  actor_list_actors_for_group: { items: [{ actor_id: "a1" }] },
  actor_list_role_kinds: { items: [{ id: "k1", name: "Farmer" }] },
  actor_list_role_holders: { items: [{ actor_id: "a1" }] },
  actor_get_actor: { id: "a1", display_name: "Amina Otieno", public_code: "M-AAA-111", created_at: `${year}-10-26T09:00:00Z` },
  actor_list_groups_for_actor: { items: [{ actor_id: "a1", group_id: "g1" }, { actor_id: "a1", group_id: "g2" }] },
  taskmanager_task_list: {
    items: [
      { id: "t1", title: "Send the seed list", status: "open", due_at: `${year}-10-30T09:00:00Z`, assigned_to: "a1", assignee_kind: "actor" },
      { id: "t2", title: "Not hers", status: "open", assigned_to: "a2", assignee_kind: "actor" },
    ],
  },
  assetmanager_hold_list: {
    items: [
      { id: "h1", quantity: 2, status: "reserved", ends_at: `${year}-10-29T12:00:00Z`, placed_by: "a1" },
      { id: "h2", quantity: 9, status: "committed", ends_at: `${year}-10-29T12:00:00Z`, placed_by: "a2" },
    ],
  },
};

const open = (replies: Parameters<typeof answering>[0] = people, id = "a1") => {
  answering(replies);
  return renderView("users", UsersView, "?open=" + id);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("one user's work and holds", () => {
  it("asks the hub for her actor, her groups, the tasks and the holds", async () => {
    open();

    await screen.findByRole("heading", { name: "Tasks" });

    expect(callsTo("actor_get_actor")).toEqual([{ actor_id: "a1" }]);
    expect(callsTo("actor_list_groups_for_actor")).toEqual([{ actor_id: "a1" }]);
    expect(callsTo("taskmanager_task_list")).toHaveLength(1);
    expect(callsTo("assetmanager_hold_list")).toHaveLength(1);
  });

  it("names her groups on the Profile card from the groups she is registered in", async () => {
    open();

    const profile = (await screen.findByRole("heading", { name: "Profile" })).closest("section") as HTMLElement;

    await within(profile).findByText("Supplier");
    expect(within(profile).getByText("Groups").nextElementSibling).toHaveTextContent("Siaya farmers Supplier");
  });

  it("lists only the tasks handed to her, with state and due date", async () => {
    open();

    const card = (await screen.findByRole("heading", { name: "Tasks" })).closest("section") as HTMLElement;

    expect(within(card).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Task", "State", "Due"]);
    const cells = within(card).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Send the seed list");
    expect(within(cells[1]).getByText("open")).toHaveClass("tag", "mute");
    expect(cells[2]).toHaveTextContent("30 Oct");
    expect(within(card).queryByText("Not hers")).not.toBeInTheDocument();
  });

  it("lists only the holds she placed, with quantity, end and state", async () => {
    open();

    const card = (await screen.findByRole("heading", { name: "Holds" })).closest("section") as HTMLElement;

    expect(within(card).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Quantity", "Until", "State"]);
    expect(within(card).getAllByRole("row")).toHaveLength(2);
    const cells = within(card).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("2");
    expect(cells[2]).toHaveTextContent("reserved");
  });

  it("says so when she has no tasks and no holds", async () => {
    open({ ...people, taskmanager_task_list: { items: [] }, assetmanager_hold_list: { items: [] } });

    expect(await screen.findByText("No tasks handed to this person.")).toBeInTheDocument();
    expect(screen.getByText("This person has no holds.")).toBeInTheDocument();
  });

  it("keeps the Profile and says the rest could not be loaded when a tool fails", async () => {
    open({ ...people, taskmanager_task_list: new McpError("taskmanager_task_list: down") });

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tasks" })).not.toBeInTheDocument();
  });

  it("asks nothing about tasks and holds on the list", async () => {
    answering(people);
    renderView("users", UsersView);

    await screen.findByText("Amina Otieno");

    expect(callsTo("taskmanager_task_list")).toHaveLength(0);
    expect(callsTo("assetmanager_hold_list")).toHaveLength(0);
  });
});
