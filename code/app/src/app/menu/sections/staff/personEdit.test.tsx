import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { GroupEditScreen } from "../residents/GroupEditScreen";
import { PersonEditScreen } from "../residents/PersonEditScreen";
import { StaffScreen } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let actor: Record<string, unknown>;
let refusal: string;

const attributeProperties = [
  { name: "phone", label: "Phone", range: "text", unique: true, required: false },
  { name: "email", label: "Email", range: "text", unique: true, required: false },
];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_actors") return { items: [actor] };
  if (name === "actor_get_actor") return actor;
  if (name === "actor_list_attribute_properties") return { items: attributeProperties };
  if (name === "actor_set_actor_attributes") {
    actor = { ...actor, attributes: { ...((actor.attributes as Record<string, unknown>) ?? {}), ...(given.attributes as Record<string, unknown>) } };
    return {};
  }
  if (name === "actor_set_actor_display_name") {
    if (refusal) throw new mcp.McpError(refusal);
    actor = { ...actor, display_name: given.display_name };
    return {};
  }
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  permissions = ["member.edit", "member.view"];
  refusal = "";
  actor = { id: "a1", display_name: "Anna Sample" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = (element: JSX.Element, pattern: string, path = pattern) =>
  render(
    <MemoryRouter initialEntries={[`/a/town${path}`]}>
      <Routes>
        <Route path={`/a/:agencyId${pattern}`} element={element} />
        <Route path="/a/:agencyId/menu/staff/people/:id/edit" element={<PersonEditScreen backTo={(id) => `/a/town/menu/staff/people?person=${id}`} />} />
        <Route path="/a/:agencyId/menu/staff/departments/:id/edit" element={<GroupEditScreen backTo={(id) => `/a/town/menu/staff/departments?group=${id}`} />} />
        <Route path="/a/:agencyId/menu/staff/crews/:id/edit" element={<GroupEditScreen backTo={(id) => `/a/town/menu/staff/crews?group=${id}`} />} />
      </Routes>
    </MemoryRouter>,
  );

const showStaff = async () => {
  show(<StaffScreen />, "/menu/staff/people");
  await userEvent.click(await screen.findByRole("button", { name: /Anna Sample/ }));
};

const rename = async (to: string) => {
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const name = screen.getByLabelText("Name");
  await userEvent.clear(name);
  await userEvent.type(name, to);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
};

describe("editing a staff member", () => {
  it("renames them from the Staff pane and the list and the pane show the new name", async () => {
    await showStaff();

    await rename("Anna Példa");

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_actor_display_name", { actor_id: "a1", display_name: "Anna Példa" }));
    expect((await screen.findAllByText("Anna Példa")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Anna Sample")).toBeNull();
  });

  it("shows the hub's words when the save is refused", async () => {
    refusal = "actor_set_actor_display_name: that name is already taken";
    await showStaff();

    await rename("Ben Sample");

    expect(await screen.findByText("that name is already taken")).toBeTruthy();
  });

  it("shows no Edit in the Staff pane to a caller without member.edit", async () => {
    permissions = ["member.view"];
    await showStaff();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    await screen.findByText("Name");

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("sets a phone from the Staff pane through actor_set_actor_attributes and the pane shows it", async () => {
    await showStaff();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(await screen.findByLabelText("Phone"), "+254 711 000 000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_actor_attributes", { actor_id: "a1", attributes: { phone: "+254 711 000 000" } }));
    expect((await screen.findAllByText("+254 711 000 000")).length).toBeGreaterThan(0);
  });

  it("shows no Edit in the Staff pane to a caller without member.edit", async () => {
    permissions = ["member.view"];
    await showStaff();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    await screen.findByText("Name");

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
