import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { UsersView } from "./UsersView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const year = new Date().getFullYear();

const hub = {
  actor_list_actors: {
    items: [
      { id: "a1", display_name: "Amina Otieno", created_at: `${year}-10-26T09:00:00Z` },
      { id: "a2", display_name: "Brian Ochieng", created_at: `${year}-10-22T09:00:00Z` },
    ],
  },
  actor_list_groups: { items: [{ id: "g1", name: "Siaya farmers" }] },
  actor_list_actors_for_group: { items: [{ actor_id: "a1" }] },
};

const waiting = (requests: unknown[]) => ({
  ...hub,
  actor_list_join_requests_for_group: { items: requests },
});

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Users page and the people waiting to join", () => {
  it("lists a person who asked to join, with the group and a Waiting for approval chip, apart from the members", async () => {
    answering(waiting([{ id: "r1", actor_id: "a2", group_id: "g1", state: "pending" }]));
    renderView("users", UsersView);

    const region = await screen.findByRole("region", { name: "Waiting for approval" });

    const cells = within(within(region).getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Brian Ochieng");
    expect(cells[1]).toHaveTextContent("Siaya farmers");
    expect(cells[2]).toHaveTextContent("Waiting for approval");
    expect(screen.getByRole("button", { name: "Amina Otieno" })).toBeInTheDocument();
  });

  it("asks only for the requests still waiting", async () => {
    answering(waiting([]));
    renderView("users", UsersView);

    await screen.findByText("Amina Otieno");

    expect(vi.mocked(callTool)).toHaveBeenCalledWith("h1", "actor_list_join_requests_for_group", { group_id: "g1", pending_only: true });
  });

  it("draws nothing extra when nobody is waiting", async () => {
    answering(waiting([]));
    renderView("users", UsersView);

    await screen.findByText("Amina Otieno");

    expect(screen.queryByRole("region", { name: "Waiting for approval" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Amina Otieno" })).toBeInTheDocument();
  });

  it("still lists the members when the requests cannot be read, and says the read failed instead of nobody waiting", async () => {
    answering({ ...hub, actor_list_join_requests_for_group: new Error("down") });
    renderView("users", UsersView);

    expect(await screen.findByText("Amina Otieno")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Waiting for approval" })).not.toBeInTheDocument();
    expect(screen.getByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Amina Otieno" })).toBeInTheDocument();
  });

  it("says nothing failed when the requests were read", async () => {
    answering(waiting([{ id: "r1", actor_id: "a2", group_id: "g1", state: "pending" }]));
    renderView("users", UsersView);

    await screen.findByRole("region", { name: "Waiting for approval" });

    expect(screen.queryByText("The page could not be loaded.")).not.toBeInTheDocument();
  });

  it("leaves the waiting people out of the member's detail page", async () => {
    answering({ ...waiting([{ id: "r1", actor_id: "a2", group_id: "g1", state: "pending" }]), actor_get_actor: { id: "a1", display_name: "Amina Otieno" } });
    renderView("users", UsersView, "?open=a1");

    await screen.findByRole("heading", { level: 1, name: "Amina Otieno" });

    expect(screen.queryByRole("region", { name: "Waiting for approval" })).not.toBeInTheDocument();
  });
});

const pending = (requests: unknown[] = [{ id: "r1", actor_id: "a2", group_id: "g1", state: "pending" }]) => waiting(requests);

describe("the manager deciding a request that waits", () => {
  it("approves from the row, straight away, and asks the list again", async () => {
    answering({ ...pending(), actor_operator_approve_join_request: {} });
    renderView("users", UsersView);
    const region = await screen.findByRole("region", { name: "Waiting for approval" });

    await userEvent.click(within(region).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(callsTo("actor_operator_approve_join_request")).toEqual([{ request_id: "r1" }]));
    await waitFor(() => expect(callsTo("actor_list_join_requests_for_group").length).toBeGreaterThan(1));
    expect(callsTo("agency_propose_write")).toEqual([]);
    expect(screen.queryByRole("region", { name: "Waiting for approval" })).not.toBeInTheDocument();
  });

  it("declines with the reason the manager typed", async () => {
    answering({ ...pending(), actor_operator_decline_join_request: {} });
    renderView("users", UsersView);
    const region = await screen.findByRole("region", { name: "Waiting for approval" });

    await userEvent.click(within(region).getByRole("button", { name: "Decline" }));
    expect(screen.getByText("Decline Brian Ochieng's request to join Siaya farmers?")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Reason (optional)" }), "Not in Siaya");
    await userEvent.click(within(screen.getByText("Decline Brian Ochieng's request to join Siaya farmers?").parentElement!).getByRole("button", { name: "Decline" }));

    await waitFor(() =>
      expect(callsTo("actor_operator_decline_join_request")).toEqual([{ request_id: "r1", silent: false, reason: "Not in Siaya" }]),
    );
    await waitFor(() => expect(screen.queryByRole("region", { name: "Waiting for approval" })).not.toBeInTheDocument());
  });

  it("declines quietly, telling the person nothing", async () => {
    answering({ ...pending(), actor_operator_decline_join_request: {} });
    renderView("users", UsersView);
    const region = await screen.findByRole("region", { name: "Waiting for approval" });

    await userEvent.click(within(region).getByRole("button", { name: "Decline" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Reason (optional)" }), "ignored");
    await userEvent.click(screen.getByRole("button", { name: "Decline quietly" }));

    await waitFor(() => expect(callsTo("actor_operator_decline_join_request")).toEqual([{ request_id: "r1", silent: true }]));
  });

  it("leaves the request waiting and decides nothing when the manager cancels", async () => {
    answering(pending());
    renderView("users", UsersView);
    const region = await screen.findByRole("region", { name: "Waiting for approval" });

    await userEvent.click(within(region).getByRole("button", { name: "Decline" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(callsTo("actor_operator_decline_join_request")).toEqual([]);
    expect(screen.queryByRole("textbox", { name: "Reason (optional)" })).not.toBeInTheDocument();
    expect(within(region).getByText("Brian Ochieng")).toBeInTheDocument();
  });
});
