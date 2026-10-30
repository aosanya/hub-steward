import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { WorkflowsView } from "../views/WorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const workflows = [
  { id: "w1", code: "W-1", name: "Group order", description: "Farmers buy together" },
  { id: "w2", code: "W-2", name: "Hire it", description: "" },
];

const scenario = (id: string, name: string, workflowId: string) => ({ id, name, summary: "", workflow_id: workflowId, result: "not_run" });

const refusal = new McpError('agency_delete_workflow: mwanachamaagency: used by a scenario: workflow "Group order" is still used by "A farmer stays silent", "Buy together"');

const hub = (more: Record<string, unknown> = {}) => ({
  agency_list_workflows: () => ({ items: workflows.filter((workflow) => !removed.has(workflow.id)) }),
  agency_list_work_items: { items: [] },
  agency_list_objectives: { items: [] },
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_scenarios: {
    items: [scenario("s1", "Buy together", "w1"), scenario("s2", "A farmer stays silent", "w1"), scenario("s3", "Shop says yes", "w2")],
  },
  agency_delete_workflow: (args: Record<string, unknown>) => {
    removed.add(String(args.workflow_id));
    return {};
  },
  ...more,
});

let removed = new Set<string>();

const show = (replies: Record<string, unknown> = hub()) => {
  answering(replies);
  return renderView("workflows", WorkflowsView);
};

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

const chooseRemove = async (index: number) => {
  await userEvent.click(within(cards()[index]).getByRole("button", { name: "Actions" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  removed = new Set();
});

describe("the Actions menu of a workflow card", () => {
  it("offers Edit, linking to the editor, and Remove", async () => {
    show();
    await screen.findByText("Group order");

    await userEvent.click(within(cards()[0]).getByRole("button", { name: "Actions" }));

    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("href", "/h/h1/workflow-edit/w1/workflow");
    expect(screen.getByRole("menuitem", { name: "Remove" })).toBeInTheDocument();
  });
});

describe("removing a workflow", () => {
  it("asks first and sends nothing until it is confirmed", async () => {
    show();
    await screen.findByText("Group order");

    await chooseRemove(0);

    expect(screen.getByText(/Remove Group order\?/)).toBeInTheDocument();
    expect(callsTo("agency_delete_workflow")).toEqual([]);
  });

  it("drops the question when it is cancelled", async () => {
    show();
    await screen.findByText("Group order");
    await chooseRemove(0);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/Remove Group order\?/)).not.toBeInTheDocument();
    expect(callsTo("agency_delete_workflow")).toEqual([]);
  });

  it("calls agency_delete_workflow and refreshes the list when the agency allows it", async () => {
    show();
    await screen.findByText("Group order");
    await chooseRemove(1);

    await userEvent.click(screen.getByRole("button", { name: "Remove workflow" }));

    await waitFor(() => expect(callsTo("agency_delete_workflow")).toEqual([{ workflow_id: "w2" }]));
    await waitFor(() => expect(screen.queryByText("Hire it")).not.toBeInTheDocument());
    expect(screen.getByText("Group order")).toBeInTheDocument();
    expect(screen.queryByText(/Remove Hire it\?/)).not.toBeInTheDocument();
  });

  it("keeps the workflow and lists the scenarios that mirror it when the agency refuses", async () => {
    show(hub({ agency_delete_workflow: refusal }));
    await screen.findByText("Group order");
    await chooseRemove(0);

    await userEvent.click(screen.getByRole("button", { name: "Remove workflow" }));

    expect(await screen.findByText("Scenarios that mirror Group order")).toBeInTheDocument();
    expect(screen.getByText("Group order was not removed: 2 test scenarios mirror it. Remove those scenarios first.")).toBeInTheDocument();
    const listed = within(screen.getByRole("table"));
    expect(listed.getByRole("link", { name: "Buy together" })).toHaveAttribute("href", "/h/h1/test?open=s1");
    expect(listed.getByRole("link", { name: "A farmer stays silent" })).toHaveAttribute("href", "/h/h1/test?open=s2");
    expect(listed.queryByText("Shop says yes")).not.toBeInTheDocument();
    expect(screen.getAllByText("Group order").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Group order" })).toHaveAttribute("href", "/h/h1/workflows?open=w1");
  });

  it("says the workflow could not be removed when the refusal is for another reason", async () => {
    show(hub({ agency_delete_workflow: new McpError("agency_delete_workflow: down"), agency_list_scenarios: { items: [scenario("s3", "Shop says yes", "w1")] } }));
    await screen.findByText("Group order");
    await chooseRemove(1);

    await userEvent.click(screen.getByRole("button", { name: "Remove workflow" }));

    expect(await screen.findByText("Hire it could not be removed.")).toBeInTheDocument();
    expect(screen.queryByText(/Scenarios that mirror/)).not.toBeInTheDocument();
  });

  it("clears the refusal when another removal is asked", async () => {
    show(hub({ agency_delete_workflow: refusal }));
    await screen.findByText("Group order");
    await chooseRemove(0);
    await userEvent.click(screen.getByRole("button", { name: "Remove workflow" }));
    await screen.findByText("Scenarios that mirror Group order");

    await chooseRemove(1);

    expect(screen.queryByText("Scenarios that mirror Group order")).not.toBeInTheDocument();
    expect(screen.getByText(/Remove Hire it\?/)).toBeInTheDocument();
  });
});
