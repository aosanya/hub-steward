import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, proposals, renderView } from "../spec/usersTesting";
import { RolesView } from "./RolesView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const scenario = (id: string, name: string, roleIds: string[]) => ({
  id,
  name,
  actors: roleIds.map((roleId, index) => ({ id: id + "a" + index, name: "Actor " + index, role_id: roleId })),
});

const hub = (scenarios: unknown[]) => ({
  agency_list_roles: {
    items: [
      { id: "r1", code: "R-1", name: "Group coordinator", kind: "human" },
      { id: "r2", code: "R-2", name: "Farmer", description: "Grows crops and sells produce." },
    ],
  },
  agency_get_role: { id: "r2", name: "Farmer", description: "Grows crops and sells produce." },
  agency_list_scenarios: { items: scenarios },
  agency_list_drafts: { items: [{ id: "d1", status: "open", description: "" }] },
});

const openFarmer = async (scenarios: unknown[]) => {
  answering(hub(scenarios));
  renderView("roles", RolesView, "?open=r2");
  await screen.findByRole("heading", { level: 1, name: "Farmer" });
  return userEvent.setup();
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("editing a role", () => {
  it("opens the form filled with the name and the description it has and updates the role directly", async () => {
    const user = await openFarmer([]);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Name *")).toHaveValue("Farmer");
    expect(screen.getByLabelText("Description")).toHaveValue("Grows crops and sells produce.");
    await user.clear(screen.getByLabelText("Name *"));
    await user.type(screen.getByLabelText("Name *"), "Grower");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(callsTo("agency_update_role")).toHaveLength(1));
    expect(callsTo("agency_update_role")[0]).toMatchObject({ role_id: "r2", name: "Grower", description: "Grows crops and sells produce." });
    expect(proposals()).toEqual([]);
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });

  it("proposes nothing when the name is cleared", async () => {
    const user = await openFarmer([]);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Name *"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required");
    expect(proposals()).toEqual([]);
  });

  it("closes the form and proposes nothing when it is cancelled, and Edit comes back", async () => {
    const user = await openFarmer([]);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Name *")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(proposals()).toEqual([]);
  });

  it("says the change could not be sent when the update is refused", async () => {
    answering({ ...hub([]), agency_update_role: new McpError("agency_update_role: boom") });
    renderView("roles", RolesView, "?open=r2");
    await screen.findByRole("heading", { level: 1, name: "Farmer" });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Name *"), "Grower");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
  });
});

describe("removing a role nothing uses", () => {
  it("asks first, deletes the role directly and goes back to the list of roles", async () => {
    const user = await openFarmer([scenario("s1", "Group order", ["r1"])]);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(callsTo("agency_delete_role")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Remove role" }));

    await waitFor(() => expect(callsTo("agency_delete_role")).toHaveLength(1));
    expect(callsTo("agency_delete_role")[0]).toEqual({ role_id: "r2" });
    expect(await screen.findByRole("heading", { level: 1, name: "Roles" })).toBeInTheDocument();
    expect(callsTo("agency_list_roles").length).toBeGreaterThan(1);
  });

  it("proposes nothing when the question is dismissed", async () => {
    const user = await openFarmer([]);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Remove role" })).not.toBeInTheDocument();
    expect(proposals()).toEqual([]);
  });
});

describe("removing a role a test scenario uses", () => {
  const used = [scenario("s1", "Buy now: the shop says yes", ["r2"]), scenario("s2", "Group order", ["r1", "r2"]), scenario("s3", "Find it", ["r1"])];

  it("keeps the role, says why and lists the scenarios that use it with a link to their actors", async () => {
    const user = await openFarmer(used);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Remove role" }));

    expect(await screen.findByText("The Farmer role was not removed: 2 test scenarios use it. Take the Farmer actor out of them first.")).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "Scenarios that use Farmer" }).closest("section") as HTMLElement;
    const rows = within(card).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Buy now: the shop says yes")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Actors tab")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/test?open=s2&tab=actors");
    expect(proposals()).toEqual([]);
    expect(screen.getByRole("heading", { level: 1, name: "Farmer" })).toBeInTheDocument();
  });

  it("shows the scenarios the agency names when it refuses the removal itself", async () => {
    answering({
      ...hub([]),
      agency_delete_role: new McpError('agency_delete_role: role "Farmer" is still used by "Buy now", "Group order"'),
    });
    renderView("roles", RolesView, "?open=r2");
    await screen.findByRole("heading", { level: 1, name: "Farmer" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Remove role" }));

    expect(await screen.findByText("The Farmer role was not removed: 2 test scenarios use it. Take the Farmer actor out of them first.")).toBeInTheDocument();
    expect(screen.getByText("Buy now")).toBeInTheDocument();
    expect(screen.getByText("Group order")).toBeInTheDocument();
  });

  it("says the change could not be sent for a refusal that is not about scenarios", async () => {
    answering({ ...hub([]), agency_delete_role: new McpError("agency_delete_role: boom") });
    renderView("roles", RolesView, "?open=r2");
    await screen.findByRole("heading", { level: 1, name: "Farmer" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Remove role" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
  });
});
