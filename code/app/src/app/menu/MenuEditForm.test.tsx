import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

  it("sends the named fields with every save even when they did not change", async () => {
    render(<MenuEditForm item={item} id="b1" idArg="budgetID" tool="accounting_budget_set" permission="accounting.manage" fields={fields} keep={["name"]} />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Department"), " East");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", name: "Road repairs", department: "Public Works East" }]]));
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

  describe("when the hub's record is read again on Save", () => {
    let present: Record<string, unknown>;

    beforeEach(() => {
      present = { ...item };
    });

    const staleForm = (onSaved = vi.fn()) => {
      render(
        <MenuEditForm
          item={item}
          id="b1"
          idArg="budgetID"
          tool="accounting_budget_set"
          permission="accounting.manage"
          fields={fields}
          readAgain={async () => present}
          onSaved={onSaved}
        />,
      );
      return onSaved;
    };

    const editDepartment = async (text: string) => {
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      const department = screen.getByLabelText("Department");
      await userEvent.clear(department);
      await userEvent.type(department, text);
    };

    it("stops, shows both values and sends nothing when the hub changed a field the person changed", async () => {
      const onSaved = staleForm();
      present = { ...item, department: "Works and Roads" };

      await editDepartment("Roads");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      const conflict = await screen.findByRole("group", { name: "Department" });
      expect(within(conflict).getByText("Works and Roads")).toBeInTheDocument();
      expect(within(conflict).getByText("Roads")).toBeInTheDocument();
      expect(within(conflict).getByRole("button", { name: "Keep mine" })).toBeInTheDocument();
      expect(within(conflict).getByRole("button", { name: "Use theirs" })).toBeInTheDocument();
      expect(saves()).toHaveLength(0);
      expect(onSaved).not.toHaveBeenCalled();
    });

    it("saves as before when the hub changed a different field", async () => {
      const onSaved = staleForm();
      present = { ...item, amount: "2000" };

      await editDepartment("Roads");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ department: "Roads" }));
      expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", department: "Roads" }]]);
      expect(screen.queryByRole("group", { name: "Department" })).toBeNull();
    });

    it("sends the person's own value after Keep mine and a second Save", async () => {
      staleForm();
      present = { ...item, department: "Works and Roads" };

      await editDepartment("Roads");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      const conflict = await screen.findByRole("group", { name: "Department" });
      await userEvent.click(within(conflict).getByRole("button", { name: "Keep mine" }));

      expect(saves()).toHaveLength(0);
      expect(screen.queryByRole("group", { name: "Department" })).toBeNull();
      expect(screen.getByLabelText("Department")).toHaveValue("Roads");

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", department: "Roads" }]]));
    });

    it("puts the hub's value in the field after Use theirs and sends nothing", async () => {
      staleForm();
      present = { ...item, department: "Works and Roads" };

      await editDepartment("Roads");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      const conflict = await screen.findByRole("group", { name: "Department" });
      await userEvent.click(within(conflict).getByRole("button", { name: "Use theirs" }));

      expect(screen.queryByRole("group", { name: "Department" })).toBeNull();
      expect(screen.getByLabelText("Department")).toHaveValue("Works and Roads");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(saves()).toHaveLength(0);
    });

    it("does not call the tool when the hub's record cannot be read again", async () => {
      render(
        <MenuEditForm
          item={item}
          id="b1"
          idArg="budgetID"
          tool="accounting_budget_set"
          permission="accounting.manage"
          fields={fields}
          readAgain={async () => {
            throw new mcp.McpError("accounting_budget_get: the hub is not answering");
          }}
        />,
      );

      await editDepartment("Roads");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("the hub is not answering")).toBeInTheDocument();
      expect(saves()).toHaveLength(0);
    });
  });
});
