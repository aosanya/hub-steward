import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { MenuEditForm } from "./MenuEditForm";

const item = { id: "b1", name: "Road repairs", department: "Public Works", amount: "1000" };

const fields = [
  { label: "Name", key: "name", required: true },
  { label: "Department", key: "department" },
  { label: "Amount", key: "amount", kind: "number" as const },
];

let permissions: string[];
let refusal: string | null;
let called: MockInstance<typeof mcp.callTool>;

beforeEach(() => {
  openAgency("town");
  permissions = ["accounting.manage"];
  refusal = null;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "agency_get_my_roles") return { permissions };
    if (refusal) throw new mcp.McpError(`accounting_budget_set: ${refusal}`);
    return {};
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const form = (onSaved = vi.fn()) => {
  render(<MenuEditForm item={item} id="b1" idArg="budgetID" tool="accounting_budget_set" permission="accounting.manage" fields={fields} onSaved={onSaved} />);
  return onSaved;
};

const saves = () => called.mock.calls.filter(([, tool]) => tool === "accounting_budget_set");

describe("the shared menu edit form", () => {
  it("shows Edit to a caller who holds the permission and the inputs once pressed", async () => {
    form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Name")).toHaveValue("Road repairs");
    expect(screen.getByLabelText("Department")).toHaveValue("Public Works");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows no Edit and no form to a caller without the permission", async () => {
    permissions = ["accounting.view"];
    form();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("saves only the field that changed and reports it", async () => {
    const onSaved = form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const department = screen.getByLabelText("Department");
    await userEvent.clear(department);
    await userEvent.type(department, "Roads");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ department: "Roads" }));
    expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", department: "Roads" }]]);
    expect(screen.queryByLabelText("Department")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("does not save while a required field is empty", async () => {
    form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Name"));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("does not call the tool when nothing changed", async () => {
    form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(saves()).toHaveLength(0);
  });

  it("shows the hub's words on a refusal and keeps the form open", async () => {
    refusal = "the amount must be above zero";
    const onSaved = form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.type(amount, "0");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the amount must be above zero")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue("0");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("closes the form on Cancel without calling the tool", async () => {
    form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Name"), " two");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(saves()).toHaveLength(0);
  });
});
