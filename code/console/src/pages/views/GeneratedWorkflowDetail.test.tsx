import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, renderView } from "../spec/usersTesting";
import { GeneratedWorkflowsView } from "./GeneratedWorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const hub = {
  agency_list_workflows: {
    items: [
      { id: "w1", code: "W-1", name: "Tender pipeline", description: "" },
      { id: "g1", code: "RC-1.add", name: "Add a tender", generated: true, generated_for: "RC-1" },
      { id: "g3", code: "RC-1.delete", name: "Delete a tender", generated: true, generated_for: "RC-1" },
    ],
  },
  agency_list_records: {
    items: [{ id: "rec1", code: "RC-1", name: "Tenders", item_name: "Tender", questions: [{ code: "title", prompt: "Title", required: true }] }],
  },
  agency_list_roles: {
    items: [
      { id: "r1", name: "Bid coordinator", permissions: ["record.RC-1.add.title"] },
      { id: "r2", name: "Programme lead", permissions: ["record.RC-1.delete"] },
    ],
  },
  agency_list_work_items: {
    items: [
      { id: "s1", workflow_id: "w1", ordinality: 1, title: "Record the tender", kind: "run_workflow", run_workflow_id: "g1" },
      { id: "s2", workflow_id: "w1", ordinality: 2, title: "Decide", kind: "yes_no", role_id: "r1" },
      {
        id: "g1s",
        workflow_id: "g1",
        ordinality: 1,
        title: "Add a tender",
        kind: "fill_form",
        role_id: "r1",
        row_record: "RC-1",
        row_action: "add",
        form_name: "Tender",
        questions: [{ prompt: "Title" }, { prompt: "Client" }, { prompt: "Closing date" }],
      },
      {
        id: "g3s",
        workflow_id: "g3",
        ordinality: 1,
        title: "Delete a tender",
        kind: "fill_form",
        role_id: "r2",
        row_record: "RC-1",
        row_action: "delete",
        form_name: "Why is it removed",
        questions: [{ prompt: "Why is it removed" }],
      },
    ],
  },
};

const open = (id: string) => {
  answering(hub);
  return renderView("workflows-generated", GeneratedWorkflowsView, "?open=" + id);
};

const cardNamed = (name: string) => screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement;

const valueOf = (card: HTMLElement, label: string) => within(card).getByText(label).nextElementSibling as HTMLElement;

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("a generated workflow's page", () => {
  it("is titled with the workflow and offers no Edit, no Remove and no other action", async () => {
    open("g1");

    expect(await screen.findByRole("heading", { level: 1, name: "Add a tender" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Add|Edit|Remove|Delete|Save)/ })).not.toBeInTheDocument();
  });

  it("says in its Workflow card that it is generated and read-only, and from which record", async () => {
    open("g1");
    await screen.findByRole("heading", { level: 1, name: "Add a tender" });

    const card = cardNamed("Workflow");
    expect(valueOf(card, "Code")).toHaveTextContent("RC-1.add");
    expect(valueOf(card, "Kind")).toHaveTextContent("Generated Read-only");
    expect(within(valueOf(card, "Generated from")).getByRole("link", { name: "Tenders (RC-1)" })).toHaveAttribute("href", "/h/h1/records?record=RC-1");
    expect(valueOf(card, "Action")).toHaveTextContent("Adds a row to Tenders");
    expect(valueOf(card, "Held by")).toHaveTextContent("Bid coordinator");
    expect(valueOf(card, "Version")).toHaveTextContent("Follows the agency's version");
    expect(within(card).getByText(/^Changes when the record changes\./)).toBeInTheDocument();
  });

  it("names the designed workflow step that runs it", async () => {
    open("g1");
    await screen.findByRole("heading", { level: 1, name: "Add a tender" });

    expect(within(valueOf(cardNamed("Workflow"), "Used by")).getByRole("link", { name: "Tender pipeline, step 1" })).toHaveAttribute("href", "/h/h1/workflows?open=w1");
  });

  it("shows its one step with the actor, the row record and action, the form and its questions", async () => {
    open("g1");
    await screen.findByRole("heading", { level: 1, name: "Add a tender" });

    const step = cardNamed("1 · Add a tender");
    expect(valueOf(step, "Kind")).toHaveTextContent("Fill a form");
    expect(valueOf(step, "Actor")).toHaveTextContent("Bid coordinator");
    expect(within(valueOf(step, "Row record")).getByRole("link", { name: "Tenders (RC-1)" })).toBeInTheDocument();
    expect(valueOf(step, "Row action")).toHaveTextContent("add");
    expect(valueOf(step, "Form")).toHaveTextContent("Tender");
    expect(valueOf(step, "Questions")).toHaveTextContent("Title, Client, Closing date");
    expect(screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Workflow", "Steps", "1 · Add a tender"]);
  });

  it("shows Delete with the record's own role and the form Why is it removed", async () => {
    open("g3");
    await screen.findByRole("heading", { level: 1, name: "Delete a tender" });

    expect(valueOf(cardNamed("Workflow"), "Held by")).toHaveTextContent("Programme lead");
    expect(valueOf(cardNamed("Workflow"), "Action")).toHaveTextContent("Deletes a row of Tenders");
    expect(valueOf(cardNamed("1 · Delete a tender"), "Form")).toHaveTextContent("Why is it removed");
    expect(valueOf(cardNamed("Workflow"), "Used by")).toHaveTextContent("—");
  });

  it("says there is nothing to show for a workflow that is not generated", async () => {
    open("w1");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });
});
