import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let group: Record<string, unknown>;
let refusal: string;
let populationReply: unknown;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: [group] };
  if (name === "actor_list_group_populations") return { items: [] };
  if (name === "actor_get_group") return { item: group };
  if (name === "actor_edit_group") {
    if (refusal) throw new mcp.McpError(refusal);
    group = { ...group, name: given.name ?? given.Name, node_type: given.NodeType, anchor_level_override: given.AnchorLevelOverrideID };
    return {};
  }
  if (name === "actor_set_group_join_mode") {
    group = { ...group, join_mode: given.join_mode };
    return {};
  }
  if (name === "actor_set_group_hidden") {
    group = { ...group, hidden: given.hidden };
    return {};
  }
  if (name === "actor_get_group_population") return populationReply;
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["group.manage", "group.settings"];
  refusal = "";
  populationReply = { total: 3 };
  group = { id: "g1", name: "Malomsor", node_type: "district", anchor_level_override: "lv1", join_mode: "open", hidden: false };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openGroup = async () => {
  const path = items.find((item) => item.title === "Groups & Associations")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Malomsor/ }));
};

describe("editing a group from its detail", () => {
  it("renames it, resends the group type and anchor level, and shows the new name", async () => {
    await openGroup();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Malomsor alsó");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "actor_edit_group", { group_id: "g1", NodeType: "district", AnchorLevelOverrideID: "lv1", name: "Malomsor alsó" }),
    );
    expect(await within(document.querySelector(".mw-detail") as HTMLElement).findByText("Malomsor alsó")).toBeTruthy();
  });

  it("changes the joining and hides the group under group.settings", async () => {
    await openGroup();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[1]);
    const joining = screen.getByLabelText("Joining");
    await userEvent.clear(joining);
    await userEvent.type(joining, "confirmed");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_group_join_mode", { group_id: "g1", join_mode: "confirmed" }));

    await userEvent.click(await screen.findByRole("button", { name: "Hide" }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_group_hidden", { group_id: "g1", hidden: true }));
    expect(await screen.findByRole("button", { name: "Show" })).toBeTruthy();
  });

  it("shows the hub's words when the save is refused", async () => {
    refusal = "actor_edit_group: a group with that name already exists";
    await openGroup();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("a group with that name already exists")).toBeTruthy();
  });

  it("shows no Edit and no Hide to a caller without the permissions", async () => {
    permissions = ["member.view"];
    await openGroup();

    await screen.findByText("Joining");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
  });

  it("offers a person no Edit to a caller without member.edit", async () => {
    permissions = ["group.manage", "group.settings", "member.view"];
    const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
    group = { id: "p1" };
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
      if (name === "agency_get_my_roles") return { permissions };
      if (name === "actor_list_actors") return { items: [{ id: "p1", display_name: "Sample Resident A", status: "active" }] };
      if (name === "actor_get_actor") return { id: "p1", display_name: "Sample Resident A", status: "active" };
      if (name === "actor_list_groups_for_actor" || name === "actor_list_groups") return { items: [] };
      return answer(name, args);
    });
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Sample Resident A/ }));
    await screen.findByText("Not in any group yet.");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

describe("editing a group from its detail at wide size", () => {
  beforeEach(() => {
    setWide(true);
    populationReply = { group_id: "g1", population: 3 };
  });

  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  const content = () => document.querySelector(".wf-main .wf-content") as HTMLElement;

  it("shows the name, the member count and Hidden no in the content pane", async () => {
    await openGroup();

    const pane = within(await waitFor(() => {
      const found = content();
      expect(found).toBeTruthy();
      return found;
    }));
    expect(await pane.findByText("Malomsor")).toBeInTheDocument();
    expect(await pane.findByText("3 members")).toBeInTheDocument();
    expect(await pane.findByText("Hidden")).toBeInTheDocument();
    expect(pane.getByText("no")).toBeInTheDocument();
  });

  it("saves a new name through actor_edit_group and shows it in the content pane", async () => {
    await openGroup();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Malomsor alsó");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "actor_edit_group", { group_id: "g1", NodeType: "district", AnchorLevelOverrideID: "lv1", name: "Malomsor alsó" }),
    );
    expect(await within(content()).findByText("Malomsor alsó")).toBeInTheDocument();
  });

  it("hides the group through actor_set_group_hidden and flips the button to Show", async () => {
    await openGroup();

    await userEvent.click(await within(content()).findByRole("button", { name: "Hide" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_group_hidden", { group_id: "g1", hidden: true }));
    expect(await within(content()).findByRole("button", { name: "Show" })).toBeInTheDocument();
    expect(within(content()).queryByRole("button", { name: "Hide" })).toBeNull();
  });

  it("shows no Edit and no Hide to a caller without the permissions", async () => {
    permissions = ["member.view"];
    await openGroup();

    await within(content()).findByText("Joining");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(within(content()).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(content()).queryByRole("button", { name: "Hide" })).toBeNull();
  });
});
