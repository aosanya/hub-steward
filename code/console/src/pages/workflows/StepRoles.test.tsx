import { fireEvent, screen, waitFor } from "@testing-library/react";
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

const stepWith = (fields: Record<string, string>) => {
  vi.mocked(callTool).mockReset();
  answering({
    agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
    agency_propose_write: {},
    agency_get_work_item: { id: "s1", ...fields },
  });
};

beforeEach(() => stepWith({ role_id: "r1", accountable_role_id: "r2" }));

describe("the accountable role of a step", () => {
  it("shows the accountable role of the step", async () => {
    show();

    expect(await screen.findByText("Supplier", { selector: "td" })).toBeInTheDocument();
    expect(screen.queryByText("Group coordinator", { selector: "td" })).not.toBeInTheDocument();
  });

  it("shows the step's own role when no accountable role is set", async () => {
    stepWith({ role_id: "r1" });
    show();

    expect(await screen.findByText("Group coordinator", { selector: "td" })).toBeInTheDocument();
  });

  it("says no role is on the step when it has neither", async () => {
    stepWith({});
    show();

    expect(await screen.findByText("No roles on this step yet.")).toBeInTheDocument();
  });

  it("proposes taking the accountable role off and then waits for approval", async () => {
    show();

    fireEvent.click(await screen.findByRole("button", { name: "Remove Supplier as Accountable" }));

    await waitFor(() =>
      expect(proposals()).toEqual([
        {
          kind: "agency_update_work_item",
          summary: "Take the accountable role off the step Open the order",
          payload: { work_item_id: "s1", accountable_role_id: "" },
        },
      ]),
    );
    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
  });

  it("proposes making a chosen role accountable, and offers it only once a role is chosen", async () => {
    show();
    await screen.findByText("Supplier", { selector: "td" });
    const set = screen.getByRole("button", { name: "Add to the step" });
    expect(set).toBeDisabled();

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "r1" } });
    expect(set).toBeEnabled();
    fireEvent.click(set);

    await waitFor(() =>
      expect(proposals()).toEqual([
        {
          kind: "agency_update_work_item",
          summary: "Make Group coordinator accountable for the step Open the order",
          payload: { work_item_id: "s1", accountable_role_id: "r1" },
        },
      ]),
    );
  });

  it("has no label choice and asks for no role assignments", async () => {
    show();
    await screen.findByText("Supplier", { selector: "td" });

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(vi.mocked(callTool).mock.calls.map((c) => c[1])).not.toContain("agency_list_role_assignments_for_work_item");
  });
});
