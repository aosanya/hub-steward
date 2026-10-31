import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, proposals, renderView } from "../spec/usersTesting";
import { StepRoles } from "./StepRoles";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const roles = [
  { value: "r1", label: "Group coordinator" },
  { value: "r2", label: "Supplier" },
];

const show = () => renderView("workflows", () => <StepRoles stepId="s1" stepName="Open the order" roles={roles} />);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  answering({
    agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
    agency_propose_write: {},
    agency_list_role_assignments_for_work_item: {
      items: [
        { id: "a1", work_item_id: "s1", role_id: "r1", label: "responsible" },
        { id: "a2", work_item_id: "s1", role_id: "r1", label: "accountable" },
        { id: "a3", work_item_id: "s1", role_id: "r2", label: "accountable" },
      ],
    },
  });
});

describe("the roles on a step", () => {
  it("lists each role once with a mark under every label it holds, two roles allowed under Accountable", async () => {
    show();

    const coordinator = within((await screen.findByText("Group coordinator", { selector: "td" })).closest("tr") as HTMLElement);
    expect(coordinator.getAllByRole("button")).toHaveLength(2);
    expect(coordinator.getByRole("button", { name: "Remove Group coordinator as Responsible" })).toBeInTheDocument();
    expect(coordinator.getByRole("button", { name: "Remove Group coordinator as Accountable" })).toBeInTheDocument();
    const supplier = within(screen.getByText("Supplier", { selector: "td" }).closest("tr") as HTMLElement);
    expect(supplier.getByRole("button", { name: "Remove Supplier as Accountable" })).toBeInTheDocument();
  });

  it("proposes taking a role off under one label and then waits for approval", async () => {
    show();

    fireEvent.click(await screen.findByRole("button", { name: "Remove Group coordinator as Accountable" }));

    await waitFor(() =>
      expect(proposals()).toEqual([
        {
          kind: "agency_delete_role_assignment",
          summary: "Take Group coordinator off the step Open the order as accountable",
          payload: { assignment_id: "a2" },
        },
      ]),
    );
    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
  });

  it("proposes adding a role under a label, and refuses the same role and label twice", async () => {
    show();
    await screen.findByText("Group coordinator", { selector: "td" });
    const add = screen.getByRole("button", { name: "Add to the step" });
    expect(add).toBeDisabled();

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "r1" } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "consulted" } });
    expect(add).toBeEnabled();
    fireEvent.click(add);

    await waitFor(() =>
      expect(proposals()).toEqual([
        {
          kind: "agency_set_raci",
          summary: "Put Group coordinator on the step Open the order as consulted",
          payload: { work_item_id: "s1", role_id: "r1", label: "consulted" },
        },
      ]),
    );
  });
});
