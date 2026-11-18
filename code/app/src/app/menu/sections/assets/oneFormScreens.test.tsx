import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { assetPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let landed = "";

const Where = () => {
  const location = useLocation();
  landed = location.pathname + location.search;
  return null;
};

const roller = { id: "e1", code: "A-12", name: "Road roller", category: "Equipment" };

beforeEach(() => {
  openAgency("town");
  permissions = ["task.edit", "asset.manage"];
  landed = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
    if (tool === "taskmanager_task_read") return { item: { id: "w1", title: "Repaint railings", state: "To do" } };
    if (tool === "taskmanager_task_list") return { items: [{ id: "w1", title: "Repaint railings", state: "To do" }] };
    if (tool === "assetmanager_asset_list") return { items: [roller] };
    if (tool === "assetmanager_asset_read") return { item: roller };
    if (tool === "assetmanager_location_list" || tool === "assetmanager_movement_list") return { items: [] };
    if (tool === "taskmanager_task_patch" || tool === "assetmanager_asset_update" || tool === "assetmanager_asset_create") return {};
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
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const callsTo = (tool: string) => called.mock.calls.filter(([, name]) => name === tool);

describe("the work order screen", () => {
  it("is the same screen for Add and for Edit: the Edit route shows the order's title and Save patches it", async () => {
    show(assetPaths.workOrderEdit.path({ id: "w1" }));

    expect(await screen.findByText("Edit work order")).toBeTruthy();
    const title = await screen.findByLabelText("Title");
    expect((title as HTMLInputElement).value).toBe("Repaint railings");
    await userEvent.clear(title);
    await userEvent.type(title, "Repaint bridge railings");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "taskmanager_task_patch", { taskID: "w1", title: "Repaint bridge railings" }));
    await waitFor(() => expect(landed).toBe(assetPaths.workOrders.path({ item: "w1" })));
  });

  it("opens the Add route on the same fields with no read", async () => {
    show(assetPaths.workOrderNew.path());

    expect(await screen.findByText("Add work order")).toBeTruthy();
    expect((await screen.findByLabelText("Title") as HTMLInputElement).value).toBe("");
    expect(callsTo("taskmanager_task_read")).toHaveLength(0);
  });

  it("opens the Edit route from the Edit act on the order's detail", async () => {
    show(assetPaths.workOrders.path());
    await userEvent.click(await screen.findByRole("button", { name: /Repaint railings/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    await waitFor(() => expect(landed).toBe(assetPaths.workOrderEdit.path({ id: "w1" })));
  });
});

describe("the asset lists", () => {
  it("carry the full-width Add asset button above Search for a holder of asset.manage", async () => {
    show(assetPaths.equipment.path());

    const button = await screen.findByRole("button", { name: "Add asset" });
    const search = await screen.findByLabelText("Search");
    expect(button.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("show no Add asset without asset.manage", async () => {
    permissions = ["asset.view"];
    show(assetPaths.equipment.path());

    await waitFor(() => expect(callsTo("agency_get_my_roles").length).toBeGreaterThan(0));
    await screen.findByLabelText("Search");
    expect(screen.queryByRole("button", { name: "Add asset" })).not.toBeInTheDocument();
  });

  it("open the one asset screen for the list's category", async () => {
    show(assetPaths.equipment.path());
    await userEvent.click(await screen.findByRole("button", { name: "Add asset" }));

    await waitFor(() => expect(landed).toBe(assetPaths.assetNew.path({ category: "Equipment" })));
  });
});

describe("the asset screen", () => {
  it("adds an asset of the list's category with a name and a tag, then returns to the list", async () => {
    show(assetPaths.assetNew.path({ category: "Equipment" }));

    expect(await screen.findByText("Add asset")).toBeTruthy();
    await userEvent.type(await screen.findByLabelText("Name"), "Water pump");
    await userEvent.type(screen.getByLabelText("Tag"), "EQ-9");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "assetmanager_asset_create", { name: "Water pump", category: "Equipment", tracking_mode: "serialized", serial_tag: "EQ-9" }));
    await waitFor(() => expect(landed).toBe(assetPaths.equipment.path()));
  });

  it("keeps Save off until the name and the tag are given", async () => {
    show(assetPaths.assetNew.path({ category: "Equipment" }));
    await userEvent.type(await screen.findByLabelText("Name"), "Water pump");

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
  });

  it("tells a caller without asset.manage that they may not add", async () => {
    permissions = [];
    show(assetPaths.assetNew.path({ category: "Equipment" }));

    expect(await screen.findByText("You may not add this.")).toBeTruthy();
  });

  it("is the same screen for Edit: the Edit route shows the asset's name and Save updates it", async () => {
    show(assetPaths.assetEdit.path({ id: "e1" }));

    expect(await screen.findByText("Edit asset")).toBeTruthy();
    const name = await screen.findByLabelText("Name");
    expect((name as HTMLInputElement).value).toBe("Road roller");
    await userEvent.clear(name);
    await userEvent.type(name, "Heavy roller");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "assetmanager_asset_update", { assetID: "e1", name: "Heavy roller", category: "Equipment" }));
    await waitFor(() => expect(landed).toBe(assetPaths.equipment.path({ item: "e1" })));
  });
});
