import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { RoleLimitsEditScreen, RolePermissionsEditScreen, RolesPermissionsScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let held: string[];
let seats: Record<string, unknown>[];
let currencyWords: Record<string, string>;

const mountsNaming = (words: Record<string, string>) => ({ modules: [{ module: "accounting", mounts: [{ name: "Finance", key: "finance", words }] }] });

const catalogue = [
  { code: "task.read", name: "Read tasks", locked: false },
  { code: "notice.post", name: "Post a notice", locked: false },
];

const answer = async (name: string) => {
  switch (name) {
    case "agency_get_my_roles":
      return { permissions: held };
    case "agency_list_publications":
      return { items: [{ channel: "production", version: 2, draft_id: "d1" }] };
    case "agency_list_roles":
      return { items: [{ id: "r1", code: "R-1", name: "Sample Clerk", permissions: ["task.read"] }] };
    case "actor_list_role_kinds":
      return { items: [{ id: "k1", definition_role_id: "R-1", name: "Sample Clerk" }] };
    case "actor_list_role_holders":
      return { items: seats };
    case "agency_list_mounts":
      return mountsNaming(currencyWords);
    case "agency_list_permissions":
      return { items: catalogue };
    case "actor_list_actors":
      return { items: [{ id: "a1", display_name: "Anna Sample" }, { id: "a2", display_name: "Ben Sample" }] };
    default:
      return { items: [] };
  }
};

beforeEach(() => {
  openAgency("town");
  held = ["role.assign", "permission.override"];
  currencyWords = { Currency: "Ft" };
  seats = [
    { id: "s1", actor_id: "a1", active: true, approval_limit: 50000 },
    { id: "s2", actor_id: "a2", active: true },
  ];
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/staff/roles"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/staff/roles" element={<RolesPermissionsScreen />} />
        <Route path="/a/:agencyId/menu/staff/roles/:id/limits" element={<RoleLimitsEditScreen />} />
        <Route path="/a/:agencyId/menu/staff/roles/:id/permissions" element={<RolePermissionsEditScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample Clerk/ }));
};

describe("a role's page is built like the resident page", () => {
  it("has the role as the title with Role and the holder count as the quiet line, no header band and the bottom bar", async () => {
    await show();
    expect(await screen.findByRole("heading", { level: 1, name: "Sample Clerk" })).toBeInTheDocument();
    expect(await screen.findByText("Role · 2 people")).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument());
  });

  it("holds a Role detail card with the name and the holders as plain rows", async () => {
    await show();
    const detail = await screen.findByRole("region", { name: "Role detail" });
    expect(within(detail).getByText("Name")).toBeInTheDocument();
    expect(within(detail).getByText("Holders")).toBeInTheDocument();
    expect(within(detail).getByText("2 people")).toBeInTheDocument();
  });

  it("lists each holder in an Approval limits card, the unset one tagged Not set, with Edit approval limits in its footer", async () => {
    await show();
    const card = await screen.findByRole("region", { name: "Approval limits" });
    expect(within(card).getByText("Anna Sample")).toBeInTheDocument();
    expect(within(card).getByText("50 000 Ft")).toBeInTheDocument();
    expect(within(card).getByText("Ben Sample")).toBeInTheDocument();
    expect(within(card).getByText("Not set")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Edit approval limits" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Save limit" })).toBeNull();
  });

  it("lists a holder's limit with no unit when the agency names no currency", async () => {
    currencyWords = {};
    await show();
    const card = await screen.findByRole("region", { name: "Approval limits" });
    expect(await within(card).findByText("50 000")).toBeInTheDocument();
    expect(within(card).queryByText(/Ft/)).toBeNull();
  });

  it("draws no Approval limits card for a reader without role.assign or for a role with no holders", async () => {
    held = ["permission.override"];
    await show();
    await screen.findByRole("region", { name: "Role detail" });
    expect(screen.queryByRole("region", { name: "Approval limits" })).toBeNull();
    cleanup();
    held = ["role.assign"];
    seats = [];
    await show();
    await screen.findByRole("region", { name: "Role detail" });
    expect(screen.queryByRole("region", { name: "Approval limits" })).toBeNull();
  });

  it("lists the permissions the role holds with a light On tag and Edit permissions in the footer, for the owner only", async () => {
    await show();
    const card = await screen.findByRole("region", { name: "Permissions" });
    expect(await within(card).findByText("Read tasks")).toBeInTheDocument();
    expect(within(card).getByText("On")).toBeInTheDocument();
    expect(within(card).queryByText("Post a notice")).toBeNull();
    expect(within(card).getByRole("button", { name: "Edit permissions" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("draws no Permissions card for a reader who is not the owner", async () => {
    held = ["role.assign"];
    await show();
    await screen.findByRole("region", { name: "Role detail" });
    expect(screen.queryByRole("region", { name: "Permissions" })).toBeNull();
  });
});

describe("the two edit screens", () => {
  it("opens the approval limit fields on their own screen from Edit approval limits, and back returns to the role", async () => {
    await show();
    await userEvent.click(await screen.findByRole("button", { name: "Edit approval limits" }));
    expect(await screen.findByRole("group", { name: "Anna Sample" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save limit" })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: /Sample Clerk/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sample Clerk" })).toBeInTheDocument();
  });

  it("opens the permission ticks on their own screen from Edit permissions", async () => {
    await show();
    await userEvent.click(await screen.findByRole("button", { name: "Edit permissions" }));
    expect(await screen.findByRole("checkbox", { name: "Read tasks" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save permissions" })).toBeDisabled();
  });
});
