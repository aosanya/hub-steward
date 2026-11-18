import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { forgetChatAbout } from "../../../chatAbout";
import { items, routes } from "./index";
import { settingsPaths } from "./paths";
import { refuseUndeclared } from "../../../declaredTools/refuseUndeclared";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let permissions: string[] = [];

let children: Record<string, unknown>[] = [];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case "agency_list_mounts":
      return { modules: [{ module: "actor" }, { module: "comm" }, { module: "ai" }] };
    case "agency_get_my_roles":
      return { permissions };
    case "actor_list_actors":
      return { items: [{ id: "p1", display_name: "Asha Otieno" }] };
    case "actor_get_actor_standing":
      return { actor_id: "p1", display_name: "Asha Otieno", seats: [{ id: "s1", role_name: "Clerk" }] };
    case "actor_list_role_kinds":
      return { items: [{ id: "k1", name: "Treasurer" }] };
    case "actor_list_groups":
      return { items: [{ id: "g1", name: "North Ward" }] };
    case "actor_get_group":
      return { id: given.group_id, name: "North Ward", area_node_id: "n1", node_type: "Ward", anchor_level_override: "lvl1" };
    case "actor_list_group_children":
      return { items: given.parent_id === "g1" ? children : [] };
    case "actor_edit_group":
      refuseUndeclared("actor_edit_group", given);
      return { id: given.group_id };
    case "actor_get_group_population":
      return { group_id: "g1", population: 1200 };
    case "ai_list_roles":
      return { items: [{ id: "r1", name: "Council helper", status: "active", description: "Reads the agenda", tokens_per_day: 500 }] };
    case "ai_get_assistant_limits":
      return { tokens_per_person_day: 100 };
    case "ai_usage_breakdown":
      return { rows: [{ person: "p1", tokens_in: 10, tokens_out: 5, requests: 1 }] };
    default:
      return { items: [] };
  }
};

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

const Where = () => {
  const at = useLocation();
  return <p data-testid="where">{`${at.pathname}${at.search}`}</p>;
};

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  permissions = [];
  children = [
    { id: "h1", name: "Otieno household, North Ward", node_type: "Household" },
    { id: "h2", name: "Wanjiru household, North Ward", node_type: "háztartás" },
    { id: "d1", name: "Works Department", node_type: "Department" },
  ];
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openAt = async (path: string, name: string) => {
  setWide(true);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        {routes()}
        <Route path="/menu/residents/people" element={<p>Resident page</p>} />
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name });
};

const openScreen = (title: string, query: string, name: string) => openAt(`${items.find((item) => item.title === title)?.path?.() ?? ""}?${query}`, name);

describe("Boundary card has one Edit screen", () => {
  it("names Edit in the card footer, only with group.manage, and leaves no bare form on the page", async () => {
    permissions = ["group.manage"];
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Boundary" });
    expect(within(card).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit boundary" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Boundary corners")).not.toBeInTheDocument();
  });

  it("hides Edit from someone without group.manage", async () => {
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Boundary" });
    expect(within(card).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("opens one screen with the area node and the corners, and Save writes both", async () => {
    permissions = ["group.manage"];
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Boundary" });
    await userEvent.click(within(card).getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/boundaries-and-areas/g1/edit");
    const node = await screen.findByLabelText("Area node");
    expect(node).toHaveValue("n1");
    await userEvent.clear(node);
    await userEvent.type(node, "n2");
    await userEvent.type(screen.getByLabelText("Boundary corners"), "19, 47{enter}20, 47{enter}20, 48");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "actor_set_group_area_node", { group_id: "g1", area_node_id: "n2" }));
    await waitFor(() =>
      expect(mcp.callTool).toHaveBeenCalledWith("", "actor_set_group_boundary", {
        group_id: "g1",
        boundary: { type: "Polygon", coordinates: [[[19, 47], [20, 47], [20, 48], [19, 47]]] },
      }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/boundaries-and-areas"));
  });
});

describe("Users & Roles gives a role from the card footer", () => {
  it("names Give a role in the Roles card footer for who may assign, and has no separate Give a role card", async () => {
    permissions = ["role.assign"];
    await openScreen("Users & Roles", "item=p1", "Asha Otieno");
    const roles = await screen.findByRole("region", { name: "Roles" });
    expect(within(roles).getByRole("button", { name: "Give a role" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Give a role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Give role" })).not.toBeInTheDocument();
  });

  it("opens the choosers from the footer act and gives the role", async () => {
    permissions = ["role.assign"];
    await openScreen("Users & Roles", "item=p1", "Asha Otieno");
    const roles = await screen.findByRole("region", { name: "Roles" });
    await userEvent.click(within(roles).getByRole("button", { name: "Give a role" }));
    expect(await screen.findByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Group")).toBeInTheDocument();
  });

  it("hides Give a role from someone without role.assign", async () => {
    await openScreen("Users & Roles", "item=p1", "Asha Otieno");
    const roles = await screen.findByRole("region", { name: "Roles" });
    expect(within(roles).queryByRole("button", { name: "Give a role" })).not.toBeInTheDocument();
  });
});

describe("Users & Roles opens the resident page", () => {
  it("has a card whose act opens the resident page of the user", async () => {
    permissions = ["resident.read"];
    await openScreen("Users & Roles", "item=p1", "Asha Otieno");
    const card = await screen.findByRole("region", { name: "Resident page" });
    await userEvent.click(within(card).getByRole("button", { name: "Open the resident page" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/menu/residents/people?person=p1");
  });

  it("shows no Resident page card to someone without resident.read", async () => {
    permissions = ["role.assign"];
    await openScreen("Users & Roles", "item=p1", "Asha Otieno");
    await screen.findByRole("region", { name: "Roles" });
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(screen.queryByRole("region", { name: "Resident page" })).not.toBeInTheDocument();
  });
});

describe("Boundary edit screen without group.manage", () => {
  it("says the caller may not change it, offers a way back, and shows no form", async () => {
    await openAt(settingsPaths.boundaryEdit.path({ id: "g1" }), "Edit boundary");
    expect(await screen.findByText("You may not change this.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Boundary corners")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/boundaries-and-areas?item=g1"));
  });
});

describe("Boundary page lists the households in the area", () => {
  it("shows a Households card of the household groups only, read once from the area's children", async () => {
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Households" });
    expect(within(card).getByText("Otieno household, North Ward")).toBeInTheDocument();
    expect(within(card).getByText("Wanjiru household, North Ward")).toBeInTheDocument();
    expect(within(card).queryByText("Works Department")).not.toBeInTheDocument();
    expect(within(card).getByText("2")).toBeInTheDocument();
    expect(mcp.callTool).toHaveBeenCalledWith("", "actor_list_group_children", { parent_id: "g1" });
  });

  it("opens the household page from a row", async () => {
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Households" });
    await userEvent.click(within(card).getByText("Otieno household, North Ward"));
    expect(screen.getByTestId("where")).toHaveTextContent("/menu/residents/households?group=h1");
  });

  it("names See all with the count past three rows and opens the Households list", async () => {
    children = ["a", "b", "c", "d", "e"].map((letter) => ({ id: `h-${letter}`, name: `Household ${letter}`, node_type: "Household" }));
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Households" });
    expect(within(card).queryByText("Household d")).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "See all 5" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/menu/residents/households");
  });

  it("says there are no households when the area has none", async () => {
    children = [{ id: "d1", name: "Works Department", node_type: "Department" }];
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Households" });
    expect(within(card).getByText("No households yet.")).toBeInTheDocument();
  });
});

describe("Boundary Edit screen also changes the name", () => {
  it("shows the name, and Save writes it with actor_edit_group keeping the type, then goes back", async () => {
    permissions = ["group.manage"];
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Boundary" });
    await userEvent.click(within(card).getByRole("button", { name: "Edit" }));
    const name = await screen.findByLabelText("Name");
    expect(name).toHaveValue("North Ward");
    await userEvent.clear(name);
    await userEvent.type(name, "Northern Ward");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mcp.callTool).toHaveBeenCalledWith("", "actor_edit_group", { group_id: "g1", Name: "Northern Ward", NodeType: "Ward", AnchorLevelOverrideID: "lvl1" }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/boundaries-and-areas"));
  });

  it("does not write the name when only the area node changed", async () => {
    permissions = ["group.manage"];
    await openScreen("Boundaries & Areas", "item=g1", "North Ward");
    const card = await screen.findByRole("region", { name: "Boundary" });
    await userEvent.click(within(card).getByRole("button", { name: "Edit" }));
    const node = await screen.findByLabelText("Area node");
    await userEvent.clear(node);
    await userEvent.type(node, "n9");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "actor_set_group_area_node", { group_id: "g1", area_node_id: "n9" }));
    expect(mcp.callTool).not.toHaveBeenCalledWith("", "actor_edit_group", expect.anything());
  });
});
