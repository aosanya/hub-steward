import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { carriedChatAbout, carriedChatFrom, forgetChatAbout } from "../../../chatAbout";
import { CrewsScreen, DepartmentsScreen, StaffScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let permissions: string[];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_actors") return { items: [{ id: "a1", display_name: "Anna Sample", status: "active" }] };
  if (name === "actor_get_actor") return { id: "a1", display_name: "Anna Sample", status: "active", attributes: { phone: "+36 20 555 0101", email: "anna@example.invalid" } };
  if (name === "actor_list_attribute_properties")
    return { items: [{ name: "phone", label: "Phone", range: "text" }, { name: "email", label: "Email", range: "text" }] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: "Sample Public Works", node_type: "Department", join_mode: "open", hidden: false }, { id: "g3", name: "Sample Road Crew", node_type: "Crew", join_mode: "open", hidden: false }] };
  if (name === "actor_get_group") return { id: given.group_id, name: given.group_id === "g3" ? "Sample Road Crew" : "Sample Public Works", node_type: given.group_id === "g3" ? "Crew" : "Department", join_mode: "open", hidden: false };
  if (name === "actor_get_group_population") return { population: 4 };
  if (name === "actor_list_group_members") return { items: [{ actor_id: "a1", display_name: "Anna Sample" }, { actor_id: "a2", display_name: "Bela Sample" }, { actor_id: "a3", display_name: "Csilla Sample" }], total: 6 };
  if (name === "actor_list_group_leaders") return { items: [] };
  if (name === "actor_list_role_assignments_for_group" || name === "actor_list_role_kinds") return { items: [] };
  if (name === "actor_list_role_assignments_for_actor") return { items: [{ id: "s1", actor_id: "a1", role_name: "Clerk", group_name: "Sample Public Works", active: true }] };
  if (name === "actor_get_actor_standing") return { seats: [] };
  if (name === "agency_list_register_details") return { items: [] };
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  permissions = ["member.edit", "group.manage", "group.settings"];
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetChatAbout();
  vi.restoreAllMocks();
});

const show = (element: JSX.Element, pattern: string) =>
  render(
    <MemoryRouter initialEntries={[`/a/town${pattern}`]}>
      <Routes>
        <Route path={`/a/:agencyId${pattern}`} element={element} />
        <Route path={`/a/:agencyId${pattern}/:id/edit`} element={<p>edit screen</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("a staff member's page is built like the resident page", () => {
  it("has the name as the title, no header band, a Staff detail card with its rows and one named Edit, and a Seats card", async () => {
    show(<StaffScreen />, "/menu/staff/people");
    await userEvent.click(await screen.findByRole("button", { name: /Anna Sample/ }));
    const title = await screen.findByRole("heading", { level: 1, name: "Anna Sample" });
    expect(title).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
    const detail = await screen.findByRole("region", { name: "Staff detail" });
    expect(within(detail).getByText("Name")).toBeInTheDocument();
    expect(await within(detail).findByText("Phone")).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit attributes" })).toBeNull();
    const seats = await screen.findByRole("region", { name: "Seats" });
    expect(await within(seats).findByText("Clerk")).toBeInTheDocument();
  });

  it("shows Edit only to a reader who may edit members", async () => {
    permissions = [];
    show(<StaffScreen />, "/menu/staff/people");
    await userEvent.click(await screen.findByRole("button", { name: /Anna Sample/ }));
    const detail = await screen.findByRole("region", { name: "Staff detail" });
    expect(within(detail).queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens the one edit screen from Edit", async () => {
    show(<StaffScreen />, "/menu/staff/people");
    await userEvent.click(await screen.findByRole("button", { name: /Anna Sample/ }));
    const detail = await screen.findByRole("region", { name: "Staff detail" });
    await userEvent.click(within(detail).getByRole("button", { name: "Edit" }));
    expect(await screen.findByText("edit screen")).toBeInTheDocument();
  });
});

describe("a department and a crew are built like the group page", () => {
  it("shows the department as the title with a Department detail card and its Edit", async () => {
    show(<DepartmentsScreen />, "/menu/staff/departments");
    await userEvent.click(await screen.findByRole("button", { name: /Sample Public Works/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sample Public Works" })).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
    const detail = await screen.findByRole("region", { name: "Department detail" });
    expect(within(detail).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument());
  });

  it("shows the crew with the crew word", async () => {
    show(<CrewsScreen />, "/menu/staff/crews");
    await userEvent.click(await screen.findByRole("button", { name: /Sample Road Crew/ }));
    expect(await screen.findByRole("region", { name: "Crew detail" })).toBeInTheDocument();
  });
});

describe("a department and a crew list their members and carry the group chat", () => {
  beforeEach(() => {
    permissions = ["member.view", "group.manage", "group.settings"];
  });

  it.each([
    ["a department", <DepartmentsScreen />, "/menu/staff/departments", /Sample Public Works/, "Sample Public Works", "Department"],
    ["a crew", <CrewsScreen />, "/menu/staff/crews", /Sample Road Crew/, "Sample Road Crew", "Crew"],
  ])("%s has a Members card with its first people and See all from the members total", async (_label, screenElement, pattern, button, name) => {
    show(screenElement, pattern);
    await userEvent.click(await screen.findByRole("button", { name: button }));
    await screen.findByRole("heading", { level: 1, name });
    const members = await screen.findByRole("region", { name: "Members" });
    expect(await within(members).findByText("Anna Sample")).toBeInTheDocument();
    expect(within(members).getByText("Csilla Sample")).toBeInTheDocument();
    expect(within(members).getByRole("button", { name: /See all 6/ })).toBeInTheDocument();
  });

  it("puts the members total on the quiet line, read once with the card", async () => {
    show(<DepartmentsScreen />, "/menu/staff/departments");
    await userEvent.click(await screen.findByRole("button", { name: /Sample Public Works/ }));
    await screen.findByRole("region", { name: "Members" });
    expect(await screen.findByText("Department · 6 members")).toBeInTheDocument();
    const reads = vi.mocked(mcp.callTool).mock.calls.filter((call) => call[1] === "actor_list_group_members");
    expect(reads.length).toBe(1);
  });

  it("shows no Members card without member.view", async () => {
    permissions = ["group.manage"];
    show(<DepartmentsScreen />, "/menu/staff/departments");
    await userEvent.click(await screen.findByRole("button", { name: /Sample Public Works/ }));
    await screen.findByRole("region", { name: "Department detail" });
    expect(screen.queryByRole("region", { name: "Members" })).toBeNull();
  });

  it.each([
    ["department", <DepartmentsScreen />, "/menu/staff/departments", /Sample Public Works/, "g1", "Sample Public Works"],
    ["crew", <CrewsScreen />, "/menu/staff/crews", /Sample Road Crew/, "g3", "Sample Road Crew"],
  ])("the Chat link on a %s carries the group", async (_label, screenElement, pattern, button, id, name) => {
    show(screenElement, pattern);
    await userEvent.click(await screen.findByRole("button", { name: button }));
    await screen.findByRole("heading", { level: 1, name });
    await userEvent.click(await screen.findByRole("link", { name: "Chat" }));
    expect(carriedChatAbout()).toEqual({ kind: "group", id, name });
    expect(carriedChatFrom()).toContain(`?group=${id}`);
  });
});
