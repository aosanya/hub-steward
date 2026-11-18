import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let person: Record<string, unknown>;
let refusal: string;

const attributeProperties = [
  { name: "phone", label: "Phone", range: "text", unique: true, required: false },
  { name: "email", label: "Email", range: "text", unique: true, required: false },
];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_actors") return { items: [person] };
  if (name === "actor_get_actor") return person;
  if (name === "actor_list_groups_for_actor" || name === "actor_list_groups") return { items: [] };
  if (name === "actor_list_attribute_properties") return { items: attributeProperties };
  if (name === "actor_set_actor_attributes") {
    person = { ...person, attributes: { ...((person.attributes as Record<string, unknown>) ?? {}), ...(given.attributes as Record<string, unknown>) } };
    return {};
  }
  if (name === "actor_set_actor_display_name") {
    if (refusal) throw new mcp.McpError(refusal);
    person = { ...person, display_name: given.display_name };
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["member.edit", "member.view"];
  refusal = "";
  person = { id: "p1", display_name: "Sample Resident A", status: "active" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openPerson = async () => {
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample Resident A/ }));
};

const rename = async (to: string) => {
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const name = screen.getByLabelText("Name");
  await userEvent.clear(name);
  await userEvent.type(name, to);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
};

describe("editing a person from their detail", () => {
  it("renames the person through actor_set_actor_display_name and the detail and the list show the new name", async () => {
    await openPerson();

    await rename("Sample Resident Z");

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_actor_display_name", { actor_id: "p1", display_name: "Sample Resident Z" }));
    expect((await screen.findAllByText("Sample Resident Z")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Sample Resident A")).toBeNull();

    expect(await screen.findByRole("button", { name: /Sample Resident Z/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sample Resident A/ })).toBeNull();
  });

  it("shows the hub's words when the save is refused", async () => {
    refusal = "actor_set_actor_display_name: that name is already taken";
    await openPerson();

    await rename("Sample Resident Z");

    expect(await screen.findByText("that name is already taken")).toBeTruthy();
  });

  it("shows no Edit to a caller without member.edit", async () => {
    permissions = ["member.view"];
    await openPerson();

    await screen.findAllByText("Sample Resident A");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("sets a phone through actor_set_actor_attributes and the detail shows it", async () => {
    await openPerson();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(await screen.findByLabelText("Phone"), "+254 711 000 000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_set_actor_attributes", { actor_id: "p1", attributes: { phone: "+254 711 000 000" } }));
    expect((await screen.findAllByText("+254 711 000 000")).length).toBeGreaterThan(0);
  });

  it("shows no Edit attributes to a caller without member.edit", async () => {
    permissions = ["member.view"];
    await openPerson();

    await screen.findAllByText("Sample Resident A");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit attributes" })).toBeNull();
  });
});
