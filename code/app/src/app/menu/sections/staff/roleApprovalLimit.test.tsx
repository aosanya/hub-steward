import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { RoleLimitsEditScreen, RolePermissionsEditScreen, RolesPermissionsScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let seats: Record<string, unknown>[];
let held: string[];
let refusal: string;
let called: MockInstance<typeof mcp.callTool>;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case "agency_get_my_roles":
      return { permissions: held };
    case "agency_list_publications":
      return { items: [{ channel: "production", version: 2, draft_id: "d1" }] };
    case "agency_list_roles":
      return { items: [{ id: "r1", code: "R-1", name: "Clerk", permissions: [] }] };
    case "actor_list_role_kinds":
      return { items: [{ id: "k1", definition_role_id: "R-1", name: "Clerk" }] };
    case "actor_list_role_holders":
      return { items: seats };
    case "agency_list_permissions":
      return { items: [] };
    case "actor_list_actors":
      return {
        items: [
          { id: "a1", display_name: "Ilona Kovacs" },
          { id: "a2", display_name: "Bela Szabo" },
        ],
      };
    case "actor_set_approval_limit": {
      if (refusal) throw new mcp.McpError(`${name}: ${refusal}`);
      const seat = seats.find((each) => each.id === given.assignment_id);
      if (!seat) throw new Error(`${name}: unknown seat`);
      if ("limit" in given) seat.approval_limit = given.limit;
      else delete seat.approval_limit;
      return seat;
    }
    default:
      throw new Error(`${name}: unknown tool`);
  }
};

beforeEach(() => {
  openAgency("town");
  seats = [];
  held = [];
  refusal = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const showClerk = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/staff/roles"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/staff/roles" element={<RolesPermissionsScreen />} />
        <Route path="/a/:agencyId/menu/staff/roles/:id/limits" element={<RoleLimitsEditScreen />} />
        <Route path="/a/:agencyId/menu/staff/roles/:id/permissions" element={<RolePermissionsEditScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Clerk/ }));
  await screen.findByText("Holders");
};

describe("the approval limit on a role's page in Roles & Permissions", () => {
  it("shows the largest limit among the standing seats with the currency unit", async () => {
    seats = [
      { actor_id: "a1", active: true, approval_limit: 50000 },
      { actor_id: "a2", active: true, approval_limit: 120000 },
    ];
    await showClerk();

    expect(await screen.findByText("Approval limit")).toBeInTheDocument();
    expect(screen.getByText("120 000 Ft")).toBeInTheDocument();
  });

  it("reads No upper limit is written when one standing seat carries no limit", async () => {
    seats = [
      { actor_id: "a1", active: true, approval_limit: 50000 },
      { actor_id: "a2", active: true },
    ];
    await showClerk();

    expect(await screen.findByText("No upper limit is written.")).toBeInTheDocument();
  });

  it("ignores the limit of a seat that has ended", async () => {
    seats = [
      { actor_id: "a1", active: true, approval_limit: 50000 },
      { actor_id: "a2", active: false, ended_at: "2026-10-01T00:00:00Z", approval_limit: 900000 },
      { actor_id: "a3", active: false, ended_at: "2026-10-01T00:00:00Z" },
    ];
    await showClerk();

    expect(await screen.findByText("50 000 Ft")).toBeInTheDocument();
    expect(screen.queryByText("No upper limit is written.")).toBeNull();
  });

  it("shows a limit of zero as zero, not as no limit", async () => {
    seats = [{ actor_id: "a1", active: true, approval_limit: 0 }];
    await showClerk();

    expect(await screen.findByText("0 Ft")).toBeInTheDocument();
  });

  it("shows no limit field when the role has no standing seats", async () => {
    await showClerk();

    expect(screen.queryByText("Approval limit")).toBeNull();
    expect(screen.queryByText(/Ft$/)).toBeNull();
    expect(screen.queryByText("No upper limit is written.")).toBeNull();
  });
});

const standingSeats = () => [
  { id: "s1", actor_id: "a1", active: true, approval_limit: 50000 },
  { id: "s2", actor_id: "a2", active: true, approval_limit: 80000 },
];

const showClerkAsAssigner = async () => {
  held = ["role.assign"];
  await showClerk();
  await screen.findByRole("region", { name: "Approval limits" });
};

const openLimits = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Edit approval limits" }));
  await screen.findAllByRole("button", { name: "Save limit" });
};

const inDetail = async () => within(await screen.findByRole("region", { name: "Role detail" }));

const seatRow = async (holder: string) => within(await screen.findByRole("group", { name: holder }));

const fillLimit = async (holder: string, text: string) => {
  const field = (await seatRow(holder)).getByLabelText(holder);
  await userEvent.clear(field);
  if (text) await userEvent.type(field, text);
  return field as HTMLInputElement;
};

const saveLimit = async (holder: string) => userEvent.click((await seatRow(holder)).getByRole("button", { name: "Save limit" }));

const setLimitCalls = () => called.mock.calls.filter(([, name]) => name === "actor_set_approval_limit");

describe("setting an approval limit per seat on a role's page in Roles & Permissions", () => {
  it("sets a limit on a seat that had none, sends a whole number and shows the new largest limit at once", async () => {
    seats = [
      { id: "s1", actor_id: "a1", active: true },
      { id: "s2", actor_id: "a2", active: true, approval_limit: 50000 },
    ];
    await showClerkAsAssigner();
    expect((await inDetail()).getByText("No upper limit is written.")).toBeInTheDocument();
    await openLimits();

    await fillLimit("Ilona Kovacs", "75 000");
    await saveLimit("Ilona Kovacs");

    expect(called).toHaveBeenCalledWith("", "actor_set_approval_limit", { assignment_id: "s1", limit: 75000 });
    expect(await (await inDetail()).findByText("75 000 Ft")).toBeInTheDocument();
    expect((await inDetail()).queryByText("No upper limit is written.")).toBeNull();
  });

  it("shows each standing seat with its holder's name and its current limit", async () => {
    seats = standingSeats();
    await showClerkAsAssigner();
    await openLimits();

    const ilona = await seatRow("Ilona Kovacs");
    const bela = await seatRow("Bela Szabo");
    expect((ilona.getByLabelText("Ilona Kovacs") as HTMLInputElement).value.replace(/\s/g, "")).toBe("50000");
    expect((bela.getByLabelText("Bela Szabo") as HTMLInputElement).value.replace(/\s/g, "")).toBe("80000");
    expect(screen.getAllByRole("button", { name: "Save limit" })).toHaveLength(2);
  });

  it("changes the limit of a seat and shows the new largest limit at once", async () => {
    seats = standingSeats();
    await showClerkAsAssigner();
    expect((await inDetail()).getByText("80 000 Ft")).toBeInTheDocument();
    await openLimits();

    await fillLimit("Ilona Kovacs", "120000");
    await saveLimit("Ilona Kovacs");

    expect(called).toHaveBeenCalledWith("", "actor_set_approval_limit", { assignment_id: "s1", limit: 120000 });
    expect(await (await inDetail()).findByText("120 000 Ft")).toBeInTheDocument();
  });

  it("clears the limit of a seat by sending no limit and reads No upper limit is written", async () => {
    seats = standingSeats();
    await showClerkAsAssigner();
    await openLimits();

    await fillLimit("Ilona Kovacs", "");
    await saveLimit("Ilona Kovacs");

    const calls = setLimitCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({ assignment_id: "s1" });
    expect("limit" in (calls[0][2] as Record<string, unknown>)).toBe(false);
    expect(await (await inDetail()).findByText("No upper limit is written.")).toBeInTheDocument();
  });

  it("keeps Save limit disabled until the value differs from the seat's current limit", async () => {
    seats = standingSeats();
    await showClerkAsAssigner();
    await openLimits();
    const row = await seatRow("Ilona Kovacs");
    expect(row.getByRole("button", { name: "Save limit" })).toBeDisabled();

    await fillLimit("Ilona Kovacs", "60000");
    expect(row.getByRole("button", { name: "Save limit" })).toBeEnabled();

    await fillLimit("Ilona Kovacs", "50000");
    expect(row.getByRole("button", { name: "Save limit" })).toBeDisabled();
    expect(setLimitCalls()).toHaveLength(0);
  });

  it("rejects an entry that is not a whole number or is negative and keeps Save limit disabled", async () => {
    seats = standingSeats();
    await showClerkAsAssigner();
    await openLimits();
    const row = await seatRow("Ilona Kovacs");

    await fillLimit("Ilona Kovacs", "12.5");
    expect(await screen.findByText("Approval limit must be a whole number")).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Save limit" })).toBeDisabled();

    await fillLimit("Ilona Kovacs", "-5");
    expect(await screen.findByText("Approval limit must be a whole number")).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Save limit" })).toBeDisabled();
    expect(setLimitCalls()).toHaveLength(0);
  });

  it("shows a refusal in words and keeps the typed value", async () => {
    seats = standingSeats();
    refusal = "that seat has ended";
    await showClerkAsAssigner();
    await openLimits();

    const field = await fillLimit("Ilona Kovacs", "75000");
    await saveLimit("Ilona Kovacs");

    expect(await screen.findByText("that seat has ended")).toBeInTheDocument();
    expect(field.value.replace(/\s/g, "")).toBe("75000");
    await userEvent.click(screen.getByRole("button", { name: /Clerk/ }));
    expect((await inDetail()).getByText("80 000 Ft")).toBeInTheDocument();
  });

  it("offers no edit and loads no names to a caller without role.assign even with permission.override", async () => {
    seats = standingSeats();
    held = ["permission.override"];
    await showClerk();

    expect(await screen.findByText("80 000 Ft")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Approval limits" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit approval limits" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save limit" })).toBeNull();
    expect(called.mock.calls.some(([, name]) => name === "actor_list_actors")).toBe(false);
  });

  it("shows no row for a seat that has ended", async () => {
    seats = [
      { id: "s1", actor_id: "a1", active: true, approval_limit: 50000 },
      { id: "s2", actor_id: "a2", active: false, ended_at: "2026-10-01T00:00:00Z", approval_limit: 900000 },
    ];
    await showClerkAsAssigner();
    await openLimits();

    expect(await screen.findByRole("group", { name: "Ilona Kovacs" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Bela Szabo" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Save limit" })).toHaveLength(1);
  });

  it("shows no Approval limits heading when the role has no standing seat", async () => {
    held = ["role.assign"];
    await showClerk();

    expect(screen.queryByRole("region", { name: "Approval limits" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit approval limits" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save limit" })).toBeNull();
  });
});
