import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { routes } from "./index";
import { settingsPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let landed = "";
let refusal = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  permissions = ["group.manage", "member.add"];
  refusal = "";
  landed = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "actor_list_groups") return { items: [{ id: "g1", name: "Óváros", node_type: "Városrész" }] };
    if (tool === "actor_list_levels") return { items: [{ id: "l1", name: "Város", depth: 0 }, { id: "l2", name: "Városrész", depth: 1, is_area: true }] };
    if (tool === "actor_list_actors") return { items: [{ id: "p1", display_name: "Kovács Anna" }] };
    if (tool === "actor_get_actor_standing") return { seats: [] };
    if (tool === "actor_create_group") {
      if (refusal) throw new mcp.McpError(refusal);
      return { id: "g2" };
    }
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        {routes()}
        <Route path={appRoutes.personNew.pattern} element={<p>The person Add screen</p>} />
      </Routes>
    </MemoryRouter>,
  );

const creates = () => called.mock.calls.filter(([, tool]) => tool === "actor_create_group");

const above = async (name: string) => {
  const button = await screen.findByRole("button", { name });
  const search = await screen.findByLabelText("Search");
  return button.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING;
};

describe("the Boundaries & Areas list", () => {
  it("carries the full-width Add area button above Search for a holder of group.manage", async () => {
    show(settingsPaths.boundariesAndAreas.path());
    expect(await above("Add area")).toBeTruthy();
  });

  it("shows no Add area without group.manage", async () => {
    permissions = [];
    show(settingsPaths.boundariesAndAreas.path());
    await screen.findByLabelText("Search");
    await waitFor(() => expect(called.mock.calls.some(([, tool]) => tool === "agency_get_my_roles")).toBe(true));
    expect(screen.queryByRole("button", { name: "Add area" })).not.toBeInTheDocument();
  });

  it("opens the Add screen with a Name and no call until Save", async () => {
    show(settingsPaths.boundariesAndAreas.path());
    await userEvent.click(await screen.findByRole("button", { name: "Add area" }));
    await waitFor(() => expect(landed).toBe(settingsPaths.boundaryNew.path()));
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(creates()).toHaveLength(0);
  });
});

describe("the area Add screen", () => {
  it("saves with actor_create_group, the name and the agency's area level, then returns to the list", async () => {
    show(settingsPaths.boundaryNew.path());
    await userEvent.type(await screen.findByLabelText("Name"), "Határrét");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(creates()).toHaveLength(1));
    expect(creates()[0][2]).toEqual({ name: "Határrét", node_type: "Városrész" });
    await waitFor(() => expect(landed).toBe(settingsPaths.boundariesAndAreas.path()));
  });

  it("says the refusal in words and stays on the screen", async () => {
    refusal = "tool error: that name is taken";
    show(settingsPaths.boundaryNew.path());
    await userEvent.type(await screen.findByLabelText("Name"), "Határrét");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/name is taken/)).toBeInTheDocument();
    expect(landed).toBe(settingsPaths.boundaryNew.path());
  });

  it("says so and makes no call when the agency has no area level", async () => {
    called.mockImplementation(async (_hub, tool) => {
      if (tool === "agency_get_my_roles") return { permissions };
      return { items: [] };
    });
    show(settingsPaths.boundaryNew.path());
    await userEvent.type(await screen.findByLabelText("Name"), "Határrét");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This agency has no level for areas yet.")).toBeInTheDocument();
    expect(creates()).toHaveLength(0);
  });

  it("tells a caller without group.manage that they may not add", async () => {
    permissions = [];
    show(settingsPaths.boundaryNew.path());
    expect(await screen.findByText("You may not add this.")).toBeInTheDocument();
  });
});

describe("the Users & Roles list", () => {
  it("carries the full-width Add person button above Search for a holder of member.add and opens the person Add screen", async () => {
    show(settingsPaths.usersAndRoles.path());
    expect(await above("Add person")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(await screen.findByText("The person Add screen")).toBeInTheDocument();
  });

  it("shows no Add person without member.add", async () => {
    permissions = ["group.manage"];
    show(settingsPaths.usersAndRoles.path());
    await screen.findByLabelText("Search");
    await waitFor(() => expect(called.mock.calls.some(([, tool]) => tool === "agency_get_my_roles")).toBe(true));
    expect(screen.queryByRole("button", { name: "Add person" })).not.toBeInTheDocument();
  });
});
