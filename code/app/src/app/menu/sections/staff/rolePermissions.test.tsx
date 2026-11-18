import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { RoleLimitsEditScreen, RolePermissionsEditScreen, RolesPermissionsScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let held: string[];
let stored: string[];
let refusal: string;

const catalogue = [
  { code: "task.read", name: "Read tasks", locked: false },
  { code: "notice.post", name: "Post a notice", locked: false },
  { code: "role.assign", name: "Give a role and take it back", locked: false },
  { code: "agency.delete", name: "Delete the agency", locked: true },
];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case "agency_get_my_roles":
      return { permissions: held };
    case "agency_list_publications":
      return { items: [{ channel: "production", version: 2, draft_id: "d1" }] };
    case "agency_list_roles":
      return { items: [{ id: "r1", code: "R-1", name: "Clerk", permissions: stored }] };
    case "actor_list_role_kinds":
      return { items: [{ id: "k1", definition_role_id: "R-1", name: "Clerk" }] };
    case "actor_list_role_holders":
      return { items: [] };
    case "agency_list_permissions":
      return { items: catalogue };
    case "agency_set_role_permissions":
      if (refusal) throw new mcp.McpError(`${name}: ${refusal}`);
      stored = given.permissions as string[];
      return { id: "r1", permissions: stored };
    default:
      throw new Error(`${name}: unknown tool`);
  }
};

beforeEach(() => {
  openAgency("town");
  held = ["permission.override", "role.assign"];
  stored = ["task.read"];
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
};

const showTicks = async () => {
  await showClerk();
  await userEvent.click(await screen.findByRole("button", { name: "Edit permissions" }));
};

describe("ticking what a role may do on Roles & Permissions", () => {
  it("shows the owner a tick for each permission the catalogue offers, ticked where the role holds it, and none for a locked code", async () => {
    await showTicks();

    expect(await screen.findByRole("checkbox", { name: "Read tasks" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Post a notice" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Give a role and take it back" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Delete the agency" })).toBeNull();
  });

  it("saves the whole list of ticked codes in one call and shows the saved ticks", async () => {
    await showTicks();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Post a notice" }));
    await userEvent.click(screen.getByRole("button", { name: "Save permissions" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "agency_set_role_permissions", { role_id: "r1", permissions: ["task.read", "notice.post"] }),
    );
    const card = await screen.findByRole("region", { name: "Permissions" });
    expect(await within(card).findByText("Post a notice")).toBeInTheDocument();
    expect(within(card).getByText("Read tasks")).toBeInTheDocument();
    expect(within(card).queryByRole("checkbox")).toBeNull();
  });

  it("sends an empty list when every tick is taken off", async () => {
    await showTicks();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Read tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Save permissions" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_set_role_permissions", { role_id: "r1", permissions: [] }));
  });

  it("keeps Save off until a tick has changed", async () => {
    await showTicks();

    expect(await screen.findByRole("button", { name: "Save permissions" })).toBeDisabled();
  });

  it("shows the hub's own words when the save is refused and keeps the ticks as they were chosen", async () => {
    refusal = "agency.delete belongs to the owner alone and cannot be given to a role";
    await showTicks();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Post a notice" }));
    await userEvent.click(screen.getByRole("button", { name: "Save permissions" }));

    expect(await screen.findByText(refusal)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Post a notice" })).toBeChecked();
  });

  it("shows no ticks and no Save to a member who holds role.assign but not permission.override", async () => {
    held = ["role.assign"];
    await showClerk();

    await screen.findByText("Holders");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save permissions" })).toBeNull();
    expect(called).not.toHaveBeenCalledWith("", "agency_list_permissions", expect.anything());
  });
});
