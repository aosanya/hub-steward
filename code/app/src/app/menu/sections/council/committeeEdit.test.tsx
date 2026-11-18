import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { CommitteesScreen } from "./CommitteesScreen";
import { CouncilEditScreen } from "./CouncilEditScreen";
import { councilPaths } from "./paths";
import { refuseUndeclared } from "../../../declaredTools/refuseUndeclared";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let groups: Record<string, unknown>[];
let refusal: string;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: groups };
  if (name === "actor_list_group_leaders") return { items: [{ actor_id: "a1", display_name: "Anna Sample" }] };
  if (name === "actor_edit_group") {
    refuseUndeclared(name, given);
    if (refusal) throw new mcp.McpError(refusal);
    groups = groups.map((group) =>
      group.id === given.group_id ? { ...group, name: given.Name, node_type: given.NodeType, anchor_level_override: given.AnchorLevelOverrideID } : group,
    );
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["group.manage"];
  refusal = "";
  groups = [{ id: "g1", name: "Sample Finance Committee", node_type: "Committee", anchor_level_override: "lv1", join_mode: "open", hidden: false }];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const showCommittee = async () => {
  render(
    <MemoryRouter initialEntries={[councilPaths.committees.path()]}>
      <Routes>
        <Route path={councilPaths.committees.pattern} element={<CommitteesScreen />} />
        <Route path={councilPaths.edit.pattern} element={<CouncilEditScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample Finance Committee/ }));
};

describe("editing a committee from its detail", () => {
  it("renames it, resends its type and anchor level, and the list and pane show the new name", async () => {
    await showCommittee();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Sample Budget Committee");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "actor_edit_group", { group_id: "g1", NodeType: "Committee", AnchorLevelOverrideID: "lv1", Name: "Sample Budget Committee" }),
    );
    expect((await screen.findAllByText("Sample Budget Committee")).length).toBeGreaterThanOrEqual(2);
    expect(groups[0]).toMatchObject({ join_mode: "open", hidden: false });
  });

  it("shows the hub's words when the save is refused", async () => {
    refusal = "actor_edit_group: a group with that name already exists";
    await showCommittee();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("a group with that name already exists")).toBeTruthy();
  });

  it("shows no Edit to a caller without group.manage", async () => {
    permissions = ["member.view"];
    await showCommittee();

    await screen.findByText("Chair");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
