import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = Record<string, unknown>;

const askerName = "Sample Asker A";
const otherName = "Sample Asker B";
const groupName = "Sample Garden Group";
const decidePermission = "join_request.decide";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let requests: Row[];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: groupName }] };
  if (name === "actor_list_join_requests_for_group") return { items: given.group_id === "g1" ? requests : [] };
  if (name === "actor_list_actors")
    return {
      items: [
        { id: "p1", display_name: askerName },
        { id: "p2", display_name: otherName },
      ],
    };
  if (name === "actor_get_actor") return { id: given.actor_id, display_name: given.actor_id === "p1" ? askerName : otherName, status: "active" };
  if (name === "actor_approve_join_request" || name === "actor_decline_join_request") {
    requests = requests.filter((request) => request.id !== given.request_id);
    return {};
  }
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  permissions = ["member.view", decidePermission];
  requests = [
    { id: "r1", actor_id: "p1", actor_name: "", state: "pending", requested_at: "2026-11-16T12:00:00Z" },
    { id: "r2", actor_id: "p2", actor_name: "", state: "pending", requested_at: "2026-11-17T12:00:00Z" },
  ];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const callsTo = (tool: string) => called.mock.calls.filter((call) => call[1] === tool).map((call) => call[2]);

const openRegistrations = async (wide: boolean) => {
  setWide(wide);
  const path = items.find((item) => item.title === "Registrations")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  if (!wide) await userEvent.click(await screen.findByRole("button", { name: new RegExp(askerName) }));
  return await screen.findByRole("region", { name: "Request" });
};

const widths = [
  { name: "a phone page", wide: false },
  { name: "the computer pane", wide: true },
];

describe("the Registrations list", () => {
  it("names the group asked for as the lighter line of each row", async () => {
    setWide(true);
    const path = items.find((item) => item.title === "Registrations")?.path?.() ?? "";
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );

    const row = await screen.findByRole("button", { name: new RegExp(askerName) });
    expect(within(row).getByText(groupName)).toBeTruthy();
  });

  it("leaves out a request that is no longer pending", async () => {
    requests = [{ ...requests[0], state: "approved" }, requests[1]];
    setWide(true);
    const path = items.find((item) => item.title === "Registrations")?.path?.() ?? "";
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: new RegExp(otherName) });
    expect(screen.queryByRole("button", { name: new RegExp(askerName) })).toBeNull();
  });
});

describe.each(widths)("the Request card on $name", (view) => {
  it("shows the group asked for and the day, with no separate Asked box", async () => {
    const card = await openRegistrations(view.wide);

    expect(within(card).getByText("Group asked for")).toBeTruthy();
    expect(within(card).getAllByText(groupName).length).toBeGreaterThan(0);
    expect(within(card).getByText("Asked on")).toBeTruthy();
    expect(screen.queryByText(/^Asked$/)).toBeNull();
  });

  it("is followed by the resident's own cards", async () => {
    await openRegistrations(view.wide);

    expect(await screen.findByRole("heading", { name: /^Groups/ })).toBeTruthy();
  });

  it("approves the request, which then leaves the list", async () => {
    const card = await openRegistrations(view.wide);

    await userEvent.click(within(card).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(callsTo("actor_approve_join_request")).toEqual([{ request_id: "r1" }]));
    await waitFor(() => expect(screen.queryByRole("button", { name: new RegExp(askerName) })).toBeNull());
  });

  it("declines the request, which then leaves the list", async () => {
    const card = await openRegistrations(view.wide);

    await userEvent.click(within(card).getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(callsTo("actor_decline_join_request")).toEqual([{ request_id: "r1" }]));
    await waitFor(() => expect(screen.queryByRole("button", { name: new RegExp(askerName) })).toBeNull());
  });

  it("shows the request without Approve or Decline to a reader who cannot decide join requests", async () => {
    permissions = ["member.view"];

    const card = await openRegistrations(view.wide);

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(within(card).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(card).queryByRole("button", { name: "Decline" })).toBeNull();
    expect(callsTo("actor_approve_join_request")).toEqual([]);
  });
});
