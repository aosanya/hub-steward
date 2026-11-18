import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let agencyName: string;
let audit: Record<string, unknown>[];
let group: Record<string, unknown>;
let seats: { id: string; role_name: string }[];
let refusal: string | null;
let languages: string[];

const square = { type: "Polygon", coordinates: [[[19, 47], [19.1, 47], [19.1, 47.1], [19, 47]]] };

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case "agency_get_my_roles":
      return { permissions };
    case "agency_get_agency":
      return { name: agencyName };
    case "instance_get_languages":
      return { studio_default: "en", content: languages, content_default: "en" };
    case "instance_set_languages":
      if (refusal) throw new mcp.McpError(`${name}: ${refusal}`);
      languages = given.content as string[];
      return {};
    case "instance_rename":
      if (refusal) throw new mcp.McpError(`${name}: ${refusal}`);
      agencyName = String(given.name);
      audit.push({ id: `e${audit.length}`, actor: "owner", action: "renamed the agency", subject: agencyName, at: "2026-11-16T10:00:00Z" });
      return { name: agencyName };
    case "audit_list_entries":
      return { items: audit };
    case "actor_list_groups":
      return { items: [{ id: "g1", name: "North Ward" }] };
    case "actor_get_group_population":
      return { population: 1200 };
    case "actor_get_group":
      return group;
    case "actor_set_group_area_node":
    case "actor_set_group_boundary":
      if (refusal) throw new mcp.McpError(`${name}: ${refusal}`);
      group = { ...group, ...(name === "actor_set_group_area_node" ? { area_node_id: given.area_node_id } : { boundary: given.boundary }) };
      return {};
    case "actor_list_actors":
      return { items: [{ id: "p1", display_name: "Asha Otieno" }] };
    case "actor_get_actor_standing":
      return { actor_id: "p1", display_name: "Asha Otieno", seats };
    case "actor_list_role_kinds":
      return { items: [{ id: "k1", name: "Secretary" }, { id: "k2", name: "Old Role", retired_at: "2026-01-01T00:00:00Z" }] };
    case "actor_grant_role":
      if (refusal) throw new mcp.McpError(`${name}: ${refusal}`);
      seats = [...seats, { id: "s3", role_name: "Secretary" }];
      return {};
    case "actor_revoke_role":
      seats = seats.filter((seat) => seat.id !== given.assignment_id);
      return {};
    default:
      throw new Error(`${name}: unknown tool`);
  }
};

beforeEach(() => {
  openAgency("town");
  permissions = ["group.manage", "role.assign"];
  languages = ["en"];
  agencyName = "Riverside Office";
  audit = [];
  group = { id: "g1", name: "North Ward", area_node_id: "node-1", boundary: square };
  seats = [{ id: "s1", role_name: "Clerk" }, { id: "s2", role_name: "Treasurer" }];
  refusal = null;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = (title: string) => {
  const path = items.find((item) => item.title === title)?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routes()}
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
};

const openNorthWard = async () => {
  open("Boundaries & Areas");
  await userEvent.click(await screen.findByRole("button", { name: /North Ward/ }));
};

const openAsha = async () => {
  open("Users & Roles");
  await userEvent.click(await screen.findByRole("button", { name: /Asha Otieno/ }));
};

const openGiveARole = async () => {
  await openAsha();
  await userEvent.click(await screen.findByRole("button", { name: "Give a role" }));
};

describe("renaming the agency", () => {
  it("renames the agency when the owner saves a new name", async () => {
    permissions = [...permissions, "permission.override"];
    open("Agency Profile");
    await screen.findByText("Riverside Office");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: /name/i });
    await userEvent.clear(name);
    await userEvent.type(name, "Lakeside Office");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "instance_rename", { name: "Lakeside Office" }));
  });
});

describe("the agency profile for the owner and for a member", () => {
  it("offers Rename and the languages to a caller who holds permission.override", async () => {
    permissions = ["permission.override"];
    open("Agency Profile");
    await screen.findByText("Riverside Office");
    expect(await screen.findByRole("button", { name: "Rename" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Change languages" })).toBeInTheDocument();
  });

  it("shows a member with other codes the profile read-only", async () => {
    open("Agency Profile");
    await screen.findByText("Riverside Office");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change languages" })).toBeNull();
  });

  it("shows the hub's words when the rename is refused", async () => {
    permissions = ["permission.override"];
    refusal = "only the owner may rename the agency";
    open("Agency Profile");
    await userEvent.click(await screen.findByRole("button", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: /name/i });
    await userEvent.clear(name);
    await userEvent.type(name, "Lakeside Office");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("only the owner may rename the agency")).toBeInTheDocument();
    expect(agencyName).toBe("Riverside Office");
  });

  it("saves the content languages the owner types", async () => {
    permissions = ["permission.override"];
    open("Agency Profile");
    await userEvent.click(await screen.findByRole("button", { name: "Change languages" }));
    const field = screen.getByRole("textbox", { name: "Content languages" });
    await userEvent.clear(field);
    await userEvent.type(field, "en, hu");
    await userEvent.click(screen.getByRole("button", { name: "Save languages" }));
    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "instance_set_languages", { studio_default: "en", content: ["en", "hu"], content_default: "en" }),
    );
  });

  it("shows the hub's words when the languages are refused", async () => {
    permissions = ["permission.override"];
    refusal = "content_default must be one of content";
    open("Agency Profile");
    await userEvent.click(await screen.findByRole("button", { name: "Change languages" }));
    const field = screen.getByRole("textbox", { name: "Content languages" });
    await userEvent.clear(field);
    await userEvent.type(field, "hu");
    await userEvent.click(screen.getByRole("button", { name: "Save languages" }));
    expect(await screen.findByText("content_default must be one of content")).toBeInTheDocument();
  });
});

describe("editing a ward from Boundaries & Areas", () => {
  it("sets the area node for a caller who holds group.manage", async () => {
    await openNorthWard();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const node = screen.getByLabelText("Area node");
    await userEvent.clear(node);
    await userEvent.type(node, "node-2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_group_area_node", { group_id: "g1", area_node_id: "node-2" }));
    expect(await screen.findByText("node-2")).toBeInTheDocument();
  });

  it("sends corners as a closed Polygon through actor_set_group_boundary", async () => {
    await openNorthWard();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const corners = screen.getByLabelText("Boundary corners");
    await userEvent.clear(corners);
    await userEvent.type(corners, "20 48{enter}20.5 48{enter}20.5 48.5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "actor_set_group_boundary", {
        group_id: "g1",
        boundary: { type: "Polygon", coordinates: [[[20, 48], [20.5, 48], [20.5, 48.5], [20, 48]]] },
      }),
    );
  });

  it("refuses fewer than three corners before anything is sent", async () => {
    await openNorthWard();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const corners = screen.getByLabelText("Boundary corners");
    await userEvent.clear(corners);
    await userEvent.type(corners, "20 48");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(called).not.toHaveBeenCalledWith("", "actor_set_group_boundary", expect.anything());
  });

  it("shows the hub's words when the area node is refused", async () => {
    await openNorthWard();
    refusal = "a group whose level is not an area is refused";

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Area node"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("a group whose level is not an area is refused")).toBeInTheDocument();
  });

  it("shows no Edit to a caller without group.manage", async () => {
    permissions = ["member.view"];
    await openNorthWard();

    await screen.findByText("node-1");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit boundary" })).toBeNull();
  });
});

describe("ending a role from Users & Roles", () => {
  it("revokes the seat for a caller who holds role.assign and drops it from the list", async () => {
    await openAsha();

    await userEvent.click(await screen.findByRole("button", { name: "End role: Treasurer" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_revoke_role", { assignment_id: "s2" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "End role: Treasurer" })).toBeNull());
    expect(screen.getByRole("button", { name: "End role: Clerk" })).toBeInTheDocument();
  });

  it("offers no End role to a caller without role.assign", async () => {
    permissions = ["member.view"];
    await openAsha();

    await screen.findAllByText("Clerk, Treasurer");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: /End role/ })).toBeNull();
  });
});

describe("giving a role from Users & Roles", () => {
  it("grants the picked role kind in the picked group and shows the new seat", async () => {
    await openGiveARole();
    const give = await screen.findByRole("button", { name: "Give role" });
    expect(give).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /^Role$/ }));
    expect(screen.queryByRole("option", { name: "Old Role" })).toBeNull();
    await userEvent.click(await screen.findByRole("option", { name: "Secretary" }));
    await userEvent.click(screen.getByRole("button", { name: /^Group$/ }));
    await userEvent.click(await screen.findByRole("option", { name: "North Ward" }));
    await userEvent.click(screen.getByRole("button", { name: "Give role" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_grant_role", { actor_id: "p1", kind_id: "k1", group_id: "g1" }));
    expect(await screen.findByRole("button", { name: "End role: Secretary" })).toBeInTheDocument();
  });

  it("shows the hub's words when the grant is refused", async () => {
    refusal = "that group already has a leader";
    await openGiveARole();

    await userEvent.click(await screen.findByRole("button", { name: /^Role$/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Secretary" }));
    await userEvent.click(screen.getByRole("button", { name: /^Group$/ }));
    await userEvent.click(await screen.findByRole("option", { name: "North Ward" }));
    await userEvent.click(screen.getByRole("button", { name: "Give role" }));

    expect(await screen.findByText("that group already has a leader")).toBeInTheDocument();
  });

  it("offers no Give role form to a caller without role.assign", async () => {
    permissions = ["member.view"];
    await openAsha();

    await screen.findAllByText("Clerk, Treasurer");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Give role" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Role/ })).toBeNull();
  });
});
