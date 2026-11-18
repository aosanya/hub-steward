import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { staffPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let landed = "";
let groups: Record<string, unknown>[];
let refusal = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const hub = () => {
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "actor_list_groups") return { items: groups };
    if (tool === "actor_create_group") {
      if (refusal) throw new mcp.McpError(refusal);
      const made = { id: `g${groups.length + 1}`, ...(args as Record<string, unknown>) };
      groups = [...groups, made];
      return made;
    }
    return { items: [] };
  });
};

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const createCalls = () => called.mock.calls.filter(([, tool]) => tool === "actor_create_group");

beforeEach(() => {
  openAgency("town");
  permissions = ["group.manage"];
  groups = [
    { id: "g1", name: "Public Works Department", node_type: "Department" },
    { id: "g2", name: "Road Repair Crew", node_type: "Crew" },
  ];
  refusal = "";
  landed = "";
  hub();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const lists = [
  { screen: "Departments", path: () => staffPaths.departments.path(), add: "Add department", nodeType: "Department", word: /department/i },
  { screen: "Crews", path: () => staffPaths.crews.path(), add: "Add crew", nodeType: "Crew", word: /crew/i },
];

describe.each(lists)("the $screen list", ({ path, add, nodeType }) => {
  it("carries the full-width Add button above Search for a holder of group.manage", async () => {
    show(path());
    const button = await screen.findByRole("button", { name: add });
    const search = await screen.findByLabelText("Search");
    expect(button.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no Add button without group.manage", async () => {
    permissions = [];
    show(path());
    await waitFor(() => expect(called.mock.calls.some(([, tool]) => tool === "agency_get_my_roles")).toBe(true));
    await screen.findAllByText(/Home/);
    expect(screen.queryByRole("button", { name: add })).not.toBeInTheDocument();
  });

  it("opens the one Add screen with a Name field and Save, and makes no call until Save", async () => {
    show(path());
    await userEvent.click(await screen.findByRole("button", { name: add }));
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(createCalls()).toHaveLength(0);
  });

  it("saves with actor_create_group, the name and the node type, then returns to the list", async () => {
    show(path());
    await userEvent.click(await screen.findByRole("button", { name: add }));
    await userEvent.type(await screen.findByLabelText("Name"), "Parks");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0][2]).toMatchObject({ name: "Parks", node_type: nodeType });
    await waitFor(() => expect(landed).toBe(path()));
  });

  it("says the refusal in words and stays on the Add screen when the hub refuses", async () => {
    refusal = "tool error: a group with that name already exists";
    show(path());
    await userEvent.click(await screen.findByRole("button", { name: add }));
    await userEvent.type(await screen.findByLabelText("Name"), "Parks");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(landed).not.toBe(path());
  });
});
