import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import type { GroupsClient, JoinableGroup } from "../../groups/api";
import { routes } from "../../routes";
import { chatTab, doSomethingTab, tabRoute } from "../../tabs";
import { JoinPage } from "./JoinPage";

const farmers: JoinableGroup = { id: "g1", name: "Siaya farmers", code: "G-S7F-4KM-2RX", approvalNeeded: true };
const supplier: JoinableGroup = { id: "g2", name: "Supplier", code: "G-U3P-8TY-5NW", approvalNeeded: true };

const fake = (over: Partial<GroupsClient> = {}): GroupsClient => ({
  listJoinableGroups: async () => [farmers, supplier],
  findGroupByCode: async (code) => (code === farmers.code ? farmers : null),
  joinGroup: async (groupId) => ({ groupId, state: "pending" }),
  listMyJoinRequests: async () => [],
  listMyGroups: async () => [],
  ...over,
});

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const show = (client: GroupsClient) =>
  render(
    <MemoryRouter initialEntries={[routes.join.path()]}>
      <Routes>
        <Route path={routes.join.pattern} element={<JoinPage client={client} />} />
        <Route path={tabRoute(chatTab)} element={<h1>Chat page</h1>} />
        <Route path={routes.roomThreads.pattern} element={<h1>Room page</h1>} />
        <Route path={tabRoute(doSomethingTab)} element={<h1>Do Something page</h1>} />
      </Routes>
    </MemoryRouter>,
  );

describe("join group", () => {
  it("lists joinable groups with their codes", async () => {
    show(fake());
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.getByText(/G-U3P-8TY-5NW/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(2);
  });

  it("shows an empty state", async () => {
    show(fake({ listJoinableGroups: async () => [] }));
    expect(await screen.findByText("No groups are open to join yet.")).toBeInTheDocument();
  });

  it("finds a group by code", async () => {
    show(fake({ listJoinableGroups: async () => [] }));
    await userEvent.type(screen.getByLabelText("Have a group code?"), "G-S7F-4KM-2RX");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
  });

  it("says when no group has the code", async () => {
    show(fake());
    await userEvent.type(screen.getByLabelText("Have a group code?"), "G-NOPE");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText("No group has that code")).toBeInTheDocument();
  });

  it("marks a group Requested after asking, with no countdown, then opens Chat", async () => {
    const joinGroup = vi.fn(async (groupId: string) => ({ groupId, state: "pending" }));
    show(fake({ joinGroup }));
    await userEvent.click((await screen.findAllByRole("button", { name: "Ask to join" }))[0]);
    const done = await screen.findByRole("button", { name: "Requested" });
    expect(done).toBeDisabled();
    expect(joinGroup).toHaveBeenCalledWith("g1");
    expect(screen.queryByText(/\d+\s*(s|sec|min|hour)/i)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Go to Chat" }));
    expect(screen.getByRole("heading", { name: "Chat page" })).toBeInTheDocument();
  });

  it("says she is in at once on an open group, with no Requested, and opens its room", async () => {
    const open: JoinableGroup = { ...farmers, approvalNeeded: false };
    const joinGroup = vi.fn(async (groupId: string) => ({ groupId, state: "joined" }));
    show(fake({ listJoinableGroups: async () => [open, supplier], joinGroup }));
    await userEvent.click(await screen.findByRole("button", { name: "Join" }));
    const row = await screen.findByRole("button", { name: /Siaya farmers.*You are in/ });
    expect(screen.queryByRole("button", { name: "Requested" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Go to Chat" })).toBeInTheDocument();
    await userEvent.click(row);
    expect(screen.getByRole("heading", { name: "Room page" })).toBeInTheDocument();
  });

  it("offers Join on an open group and Ask to join on one that needs approval", async () => {
    const open: JoinableGroup = { ...farmers, approvalNeeded: false };
    show(fake({ listJoinableGroups: async () => [open, supplier] }));
    expect(await screen.findByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(1);
    expect(screen.getAllByText(/Approval needed/)).toHaveLength(1);
  });

  it("keeps Requested for a group that needs approval", async () => {
    const joinGroup = vi.fn(async (groupId: string) => ({ groupId, state: "pending" }));
    show(fake({ joinGroup }));
    await userEvent.click((await screen.findAllByRole("button", { name: "Ask to join" }))[0]);
    expect(await screen.findByRole("button", { name: "Requested" })).toBeDisabled();
    expect(screen.queryByText("You are in")).toBeNull();
  });

  it("puts the code on one line and Approval needed on the next", async () => {
    show(fake());
    const row = (await screen.findByText("Siaya farmers")).closest(".row") as HTMLElement;
    const lines = Array.from(row.querySelectorAll(".meta")).map((el) => el.textContent);
    expect(lines).toEqual(["G-S7F-4KM-2RX", "Approval needed"]);
  });

  it("sets the group code in the code style", async () => {
    show(fake());
    const row = (await screen.findByText("Siaya farmers")).closest(".row") as HTMLElement;
    expect(row.querySelector(".meta.code")?.textContent).toBe("G-S7F-4KM-2RX");
  });

  it("gives every row a lead letter square", async () => {
    const { container } = show(fake({ listMyGroups: async () => [{ id: "g3", name: "Boda riders" }] }));
    await screen.findByText("Siaya farmers");
    const letters = Array.from(container.querySelectorAll(".row .lead")).map((el) => el.textContent);
    expect(letters).toEqual(["B", "S", "S"]);
  });

  it("shows an earlier request as Requested", async () => {
    show(fake({ listMyJoinRequests: async () => [{ groupId: "g2", state: "pending" }] }));
    expect(await screen.findByRole("button", { name: "Requested" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(1);
  });

  it("does not read a declined request as Requested, and lets her ask again", async () => {
    show(fake({ listMyJoinRequests: async () => [{ groupId: "g2", state: "declined" }] }));
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Requested" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(2);
  });

  it("says she is in after approval and opens the group's room, with no row reading Requested for it", async () => {
    show(
      fake({
        listMyJoinRequests: async () => [{ groupId: "g1", state: "approved" }],
        listMyGroups: async () => [{ id: "g1", name: "Siaya farmers" }],
      }),
    );
    const row = await screen.findByRole("button", { name: /Siaya farmers.*You are in/ });
    expect(screen.queryByRole("button", { name: "Requested" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(1);
    await userEvent.click(row);
    expect(screen.getByRole("heading", { name: "Room page" })).toBeInTheDocument();
  });

  it("lists a group she is in even when the agency no longer lists it as joinable", async () => {
    show(
      fake({
        listJoinableGroups: async () => [supplier],
        listMyGroups: async () => [{ id: "g1", name: "Siaya farmers" }],
      }),
    );
    expect(await screen.findByRole("button", { name: /Siaya farmers.*You are in/ })).toBeInTheDocument();
    expect(screen.getByText("Supplier")).toBeInTheDocument();
  });

  it("still lists the groups to join when her own groups cannot be read", async () => {
    show(fake({ listMyGroups: async () => Promise.reject(new Error("x")) }));
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ask to join" })).toHaveLength(2);
  });

  it("reports a failure", async () => {
    show(fake({ listJoinableGroups: async () => Promise.reject(new Error("x")) }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("goes back to Do Something", async () => {
    show(fake());
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Do Something page" })).toBeInTheDocument();
  });
});
