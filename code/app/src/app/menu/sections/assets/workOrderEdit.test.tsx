import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let order: Record<string, string>;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "taskmanager_task_list") return { items: [order] };
  if (name === "taskmanager_task_read") return { item: order };
  if (name === "taskmanager_task_patch") {
    const { taskID: _taskID, ...fields } = given;
    order = { ...order, ...fields };
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["task.edit"];
  order = { id: "w1", title: "Repaint railings", state: "To do" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openOrder = async () => {
  const path = items.find((item) => item.title === "Work Orders")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Repaint railings/ }));
};

describe("editing a work order from its detail", () => {
  it("lets a caller with task.edit retitle it and shows the new title in the list", async () => {
    await openOrder();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Repaint bridge railings");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "taskmanager_task_patch", { taskID: "w1", title: "Repaint bridge railings" }));
    expect((await screen.findAllByText("Repaint bridge railings")).length).toBeGreaterThan(1);
  });

  it("shows no Edit to a caller without task.edit", async () => {
    permissions = ["task.read"];
    await openOrder();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
