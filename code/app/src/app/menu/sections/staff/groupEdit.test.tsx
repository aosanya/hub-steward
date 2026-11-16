import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { CrewsScreen, DepartmentsScreen } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let groups: Record<string, unknown>[];
let refusal: string;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: groups };
  if (name === "actor_get_group_population") return { population: 4 };
  if (name === "actor_list_group_leaders") return { items: [] };
  if (name === "actor_edit_group") {
    if (refusal) throw new mcp.McpError(refusal);
    groups = groups.map((group) =>
      group.id === given.group_id ? { ...group, name: given.name, node_type: given.NodeType, anchor_level_override: given.AnchorLevelOverrideID } : group,
    );
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["group.manage"];
  refusal = "";
  groups = [
    { id: "g1", name: "Sample Public Works", node_type: "Department", anchor_level_override: "lv1", join_mode: "open", hidden: false },
    { id: "g3", name: "Sample Road Crew", node_type: "Crew", anchor_level_override: "lv2", join_mode: "open", hidden: false },
  ];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = (element: JSX.Element, pattern: string) =>
  render(
    <MemoryRouter initialEntries={[`/a/town${pattern}`]}>
      <Routes>
        <Route path={`/a/:agencyId${pattern}`} element={element} />
      </Routes>
    </MemoryRouter>,
  );

const showDepartment = async () => {
  show(<DepartmentsScreen />, "/menu/staff/departments");
  await userEvent.click(await screen.findByRole("button", { name: /Sample Public Works/ }));
};

const showCrew = async () => {
  show(<CrewsScreen />, "/menu/staff/crews");
  await userEvent.click(await screen.findByRole("button", { name: /Sample Road Crew/ }));
};

const rename = async (to: string) => {
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const name = screen.getByLabelText("Name");
  await userEvent.clear(name);
  await userEvent.type(name, to);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
};

describe("editing a department or a crew from its detail", () => {
  it("renames a department, resends its type and anchor level, and the list and pane show the new name", async () => {
    await showDepartment();

    await rename("Sample Works and Roads");

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "actor_edit_group", {
        group_id: "g1",
        NodeType: "Department",
        AnchorLevelOverrideID: "lv1",
        name: "Sample Works and Roads",
      }),
    );
    expect((await screen.findAllByText("Sample Works and Roads")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Sample Public Works")).toBeNull();
    expect(groups[0]).toMatchObject({ join_mode: "open", hidden: false, node_type: "Department", anchor_level_override: "lv1" });
  });

  it("renames a crew and resends its own type and anchor level", async () => {
    await showCrew();

    await rename("Sample Roads Crew");

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "actor_edit_group", { group_id: "g3", NodeType: "Crew", AnchorLevelOverrideID: "lv2", name: "Sample Roads Crew" }),
    );
    expect((await screen.findAllByText("Sample Roads Crew")).length).toBeGreaterThanOrEqual(2);
  });

  it("shows the hub's words when the save is refused", async () => {
    refusal = "actor_edit_group: a group with that name already exists";
    await showDepartment();

    await rename("Sample Registry");

    expect(await screen.findByText("a group with that name already exists")).toBeTruthy();
  });

  it("shows no Edit to a caller without group.manage", async () => {
    permissions = ["member.view"];
    await showDepartment();

    await screen.findByText("Head count");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
