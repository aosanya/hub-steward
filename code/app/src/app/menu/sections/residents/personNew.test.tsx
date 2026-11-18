import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let landed = "";
let people: Record<string, unknown>[];
let refusal = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const attributeProperties = [
  { name: "phone", label: "Phone", range: "text", unique: true, required: false },
  { name: "address", label: "Address", range: "text", unique: false, required: false },
];

const hub = () => {
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "actor_list_actors") return { items: people };
    if (tool === "actor_list_attribute_properties") return { items: attributeProperties };
    if (tool === "actor_list_groups") return { items: [] };
    if (tool === "actor_create_actor") {
      if (refusal) throw new mcp.McpError(refusal);
      const made = { id: `p${people.length + 1}`, status: "active", ...(args as Record<string, unknown>) };
      people = [...people, made];
      return made;
    }
    return { items: [] };
  });
};

const showList = () =>
  render(
    <MemoryRouter initialEntries={[residentPaths.people.path()]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const showForm = () =>
  render(
    <MemoryRouter initialEntries={[appRoutes.personNew.path()]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const createCalls = () => called.mock.calls.filter(([, tool]) => tool === "actor_create_actor");

beforeEach(() => {
  openAgency("town");
  people = [{ id: "a1", display_name: "Szabó Katalin", status: "active" }];
  permissions = ["member.add", "member.read"];
  refusal = "";
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("adding a person who lives in the town from All People", () => {
  it("shows an Add person button to a holder of member.add and none to anyone else", async () => {
    hub();
    showList();
    expect(await screen.findByRole("link", { name: "Add person" })).toBeInTheDocument();
    cleanup();
    permissions = ["member.read"];
    hub();
    showList();
    await screen.findByText("Szabó Katalin");
    expect(screen.queryByRole("link", { name: "Add person" })).toBeNull();
  });

  it("asks for the Name and every text property of the hub, the Name being required", async () => {
    hub();
    showForm();
    expect(await screen.findByLabelText("Phone (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Address (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("creates the person with the name and the filled attributes only and lands on All People showing them", async () => {
    const user = userEvent.setup();
    hub();
    showForm();
    await user.type(await screen.findByLabelText("Name"), "Varga Mária");
    await user.type(screen.getByLabelText("Address (optional)"), "Malom utca 4");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Varga Mária")).toBeInTheDocument();
    expect(createCalls()).toEqual([["", "actor_create_actor", { display_name: "Varga Mária", is_agentic: false, attributes: { address: "Malom utca 4" } }]]);
    expect(landed).toBe(residentPaths.people.path());
  });

  it("says why when the hub refuses and stays on the form", async () => {
    const user = userEvent.setup();
    refusal = "actor.actor.create: forbidden";
    hub();
    showForm();
    await user.type(await screen.findByLabelText("Name"), "Varga Mária");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("forbidden")).toBeInTheDocument();
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(landed).toBe(appRoutes.personNew.path());
  });
});
