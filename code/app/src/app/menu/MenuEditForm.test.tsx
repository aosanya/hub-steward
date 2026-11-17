import { vi, type MockInstance } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("sends a field of kind number as a JSON number and reports the typed text", async () => {
    const onSaved = form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.type(amount, "2500");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", amount: 2500 }]]));
    expect(onSaved).toHaveBeenCalledWith({ amount: "2500" });
  });

  it("sends a kept field of kind number as a number", async () => {
    render(<MenuEditForm item={item} id="b1" idArg="budgetID" tool="accounting_budget_set" permission="accounting.manage" fields={fields} keep={["amount"]} />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Department"), " East");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", amount: 1000, department: "Public Works East" }]]));
  });

  it("keeps a number that is not a field as a number", async () => {
    render(<MenuEditForm item={{ ...item, year: 2026 }} id="b1" idArg="budgetID" tool="accounting_budget_set" permission="accounting.manage" fields={fields} keep={["year"]} />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Department"), " East");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", year: 2026, department: "Public Works East" }]]));
  });

  it.each([["abc"], ["12x"], ["1,5"], ["-"], [""]])("shows that %j is not a number and keeps Save disabled", async (typed) => {
    form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    if (typed) await userEvent.type(amount, typed);

    expect(screen.getByText("Amount must be a number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(saves()).toHaveLength(0);
  });

  it("shows no number error while the amount is a number", async () => {
    form();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.type(amount, "12.5");

    expect(screen.queryByText("Amount must be a number")).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
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

  describe("when the save carries the version the form loaded", () => {
    const loaded = { ...item, updated_at: "2026-11-16T10:00:00Z" };
    const changedSince = "amount changed since you read it";
    let present: Record<string, unknown>;
    let reads: number;

    beforeEach(() => {
      present = { ...loaded };
      reads = 0;
    });

    const versionedForm = (onSaved = vi.fn()) => {
      render(
        <MenuEditForm
          item={loaded}
          id="b1"
          idArg="budgetID"
          tool="accounting_budget_set"
          permission="accounting.manage"
          fields={fields}
          readAgain={async () => {
            reads += 1;
            return reads === 1 ? loaded : present;
          }}
          onSaved={onSaved}
        />,
      );
      return onSaved;
    };

    const typeAmount = async (text: string) => {
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      const amount = screen.getByLabelText("Amount");
      await userEvent.clear(amount);
      await userEvent.type(amount, text);
    };

    const refuseWith = (words: string) => {
      called.mockImplementation(async (_agency, name) => {
        if (name === "agency_get_my_roles") return { permissions };
        if (name === "accounting_budget_set") throw new mcp.McpError(`accounting_budget_set: ${words}`);
        return {};
      });
    };

    it("sends version taken from the loaded item's updated_at as a string", async () => {
      render(<MenuEditForm item={loaded} id="b1" idArg="budgetID" tool="accounting_budget_set" permission="accounting.manage" fields={fields} />);

      await typeAmount("2500");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", version: "2026-11-16T10:00:00Z", amount: 2500 }]]));
    });

    it("sends no version when the loaded item has no updated_at", async () => {
      form();

      await typeAmount("2500");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { budgetID: "b1", amount: 2500 }]]));
    });

    it("renders the stale state for the named field, keeps the typed value and shows the value saved first", async () => {
      const onSaved = versionedForm();
      refuseWith(changedSince);
      present = { ...loaded, amount: "1200", updated_at: "2026-11-16T10:05:00Z" };

      await typeAmount("1500");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      const stale = await screen.findByRole("group", { name: "Amount" });
      expect(within(stale).getByText("1200")).toBeInTheDocument();
      expect(within(stale).getByText("1500")).toBeInTheDocument();
      expect(within(stale).getByRole("button", { name: "Keep mine" })).toBeInTheDocument();
      expect(within(stale).getByRole("button", { name: "Use theirs" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("1500");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it("sends nothing further after the refusal until the person chooses", async () => {
      versionedForm();
      refuseWith(changedSince);
      present = { ...loaded, amount: "1200", updated_at: "2026-11-16T10:05:00Z" };

      await typeAmount("1500");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByRole("group", { name: "Amount" });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(saves()).toHaveLength(1);
    });

    it("sends the person's value with the version just read after Keep mine", async () => {
      versionedForm();
      refuseWith(changedSince);
      present = { ...loaded, amount: "1200", updated_at: "2026-11-16T10:05:00Z" };

      await typeAmount("1500");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      const stale = await screen.findByRole("group", { name: "Amount" });
      refusal = null;
      called.mockImplementation(async (_agency, name) => (name === "agency_get_my_roles" ? { permissions } : {}));
      await userEvent.click(within(stale).getByRole("button", { name: "Keep mine" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saves()).toHaveLength(2));
      expect(saves()[1]).toEqual(["", "accounting_budget_set", { budgetID: "b1", version: "2026-11-16T10:05:00Z", amount: 1500 }]);
    });

    it("shows the hub's words as a plain refusal when a 409 names no field of the form", async () => {
      versionedForm();
      refuseWith("owner changed since you read it");

      await typeAmount("1500");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("owner changed since you read it")).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Amount" })).toBeNull();
    });
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

describe("the shared menu edit form with a list-of-lines field", () => {
  const listItem = { id: "m1", name: "Spring meeting", items: ["Welcome", "Road repairs"] };
  const listFields = [
    { label: "Name", key: "name" },
    { label: "Agenda items, one per line", key: "items", kind: "lines" as const },
  ];
  const lineForm = (keep: string[] = [], onSaved = vi.fn()) => {
    render(<MenuEditForm item={listItem} id="m1" idArg="meetingID" tool="accounting_budget_set" permission="accounting.manage" fields={listFields} keep={keep} onSaved={onSaved} />);
    return onSaved;
  };

  it("shows the items one per line in a multi-line box", async () => {
    lineForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const box = screen.getByLabelText("Agenda items, one per line");
    expect(box.tagName).toBe("TEXTAREA");
    expect(box).toHaveValue("Welcome\nRoad repairs");
  });

  it("sends the lines as an array of trimmed items without blank lines and reports the typed text", async () => {
    const onSaved = lineForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Agenda items, one per line"), "{Enter}  {Enter}Close  ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { meetingID: "m1", items: ["Welcome", "Road repairs", "Close"] }]]));
    expect(onSaved).toHaveBeenCalledWith({ items: "Welcome\nRoad repairs\n  \nClose  " });
  });

  it("sends an emptied list as an empty array", async () => {
    lineForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Agenda items, one per line"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { meetingID: "m1", items: [] }]]));
  });

  it("sends a kept lines field as an array", async () => {
    lineForm(["items"]);

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Name"), " 2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { meetingID: "m1", items: ["Welcome", "Road repairs"], name: "Spring meeting 2" }]]));
  });

  it("does not save when only blank lines were added", async () => {
    lineForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Agenda items, one per line"), "{Enter}  {Enter}");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("the shared menu edit form with a date field", () => {
  const dateItem = { id: "t1", title: "Road tender", closes_at: "2026-12-01T00:00:00Z" };
  const dateFields = [
    { label: "Title", key: "title" },
    { label: "Closes", key: "closes_at", kind: "date" as const },
  ];
  const dateForm = (keep: string[] = [], onSaved = vi.fn(), record: Record<string, unknown> = dateItem) => {
    render(<MenuEditForm item={record} id="t1" idArg="tenderID" tool="accounting_budget_set" permission="accounting.manage" fields={dateFields} keep={keep} onSaved={onSaved} />);
    return onSaved;
  };

  it("shows a recorded instant as its day", async () => {
    dateForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Closes")).toHaveValue("2026-12-01");
  });

  it("sends a changed day as an instant and reports the typed day", async () => {
    const onSaved = dateForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Closes"), { target: { value: "2026-12-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { tenderID: "t1", closes_at: "2026-12-15T00:00:00Z" }]]));
    expect(onSaved).toHaveBeenCalledWith({ closes_at: "2026-12-15" });
  });

  it("does not save when the day was not changed", async () => {
    dateForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("sends a kept date as the instant the hub recorded", async () => {
    dateForm(["closes_at"]);

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Title"), " 2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { tenderID: "t1", closes_at: "2026-12-01T00:00:00Z", title: "Road tender 2" }]]));
  });

  it("keeps the recorded time of day of a kept date that was not edited", async () => {
    dateForm(["closes_at"], vi.fn(), { ...dateItem, closes_at: "2026-12-01T09:30:00Z" });

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Title"), " 2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { tenderID: "t1", closes_at: "2026-12-01T09:30:00Z", title: "Road tender 2" }]]));
  });

  it("sends a cleared day as empty text rather than an instant", async () => {
    dateForm();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Closes"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { tenderID: "t1", closes_at: "" }]]));
  });

  it("saves through the call a build prop shapes from the changed fields", async () => {
    const build = (sent: Record<string, unknown>) => ({ form_id: "f1", answers: Object.entries(sent).map(([question_id, value]) => ({ question_id, value })) });
    render(<MenuEditForm item={item} id="b1" idArg="budgetID" tool="accounting_budget_set" permission="accounting.manage" fields={fields} build={build} />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Department"), "!");
    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.type(amount, "2500");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves()).toEqual([["", "accounting_budget_set", { form_id: "f1", answers: [{ question_id: "department", value: "Public Works!" }, { question_id: "amount", value: 2500 }] }]]));
  });
});
