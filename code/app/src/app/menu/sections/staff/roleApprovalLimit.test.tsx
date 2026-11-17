import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { RolesPermissionsScreen } from "./index";

let seats: Record<string, unknown>[];

const answer = async (name: string) => {
  switch (name) {
    case "agency_get_my_roles":
      return { permissions: [] };
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
    default:
      throw new Error(`${name}: unknown tool`);
  }
};

beforeEach(() => {
  openAgency("town");
  seats = [];
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
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
