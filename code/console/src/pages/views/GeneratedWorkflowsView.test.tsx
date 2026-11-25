import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { GeneratedWorkflowsView } from "./GeneratedWorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const generated = (id: string, code: string, name: string, more: Record<string, unknown> = {}) => ({
  id,
  code,
  name,
  description: "",
  generated: true,
  generated_for: code.split(".")[0],
  ...more,
});

const hub = {
  agency_list_workflows: {
    items: [
      { id: "w9", code: "W-9", name: "Register a project", description: "" },
      generated("g1", "RC-1.add", "Add a tender"),
      generated("g2", "RC-1.edit", "Edit a tender"),
      generated("g3", "RC-1.delete", "Delete a tender"),
      generated("g4", "RC-2.add", "Add a project", { replaced_by: "W-9" }),
      generated("g5", "RC-2.edit", "Edit a project"),
      generated("g6", "RC-2.delete", "Delete a project"),
    ],
  },
  agency_list_records: {
    items: [
      { id: "rec1", code: "RC-1", name: "Tenders", item_name: "Tender", questions: [{ code: "title", prompt: "Title", required: true }] },
      { id: "rec2", code: "RC-2", name: "Projects", item_name: "Project", add_replaced_by: "W-9", questions: [{ code: "name", prompt: "Name", required: true }] },
    ],
  },
  agency_list_roles: {
    items: [
      { id: "r1", name: "Bid coordinator", permissions: ["record.RC-1.add.*", "record.RC-1.edit.*", "record.RC-1.delete"] },
      { id: "r2", name: "Project officer", permissions: ["record.RC-2.add.name", "record.RC-2.edit.name"] },
      { id: "r3", name: "Programme lead", permissions: ["record.RC-2.delete", "record.RC-1.delete"] },
    ],
  },
};

const show = (replies: Parameters<typeof answering>[0] = hub) => {
  answering(replies);
  return renderView("workflows-generated", GeneratedWorkflowsView);
};

const rows = () => Array.from(document.querySelectorAll<HTMLElement>("tbody tr"));

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Generated Workflows page", () => {
  it("is titled Generated Workflows and offers no Add and no Edit", async () => {
    show();

    expect(await screen.findByRole("heading", { level: 1, name: "Generated Workflows" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add a workflow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add a cancel workflow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Add|Edit|Remove)/ })).not.toBeInTheDocument();
  });

  it("lists one row for each generated workflow and none for a designed one", async () => {
    show();

    await screen.findByText("Add a tender");

    expect(rows()).toHaveLength(6);
    expect(rows().map((row) => row.querySelector(".cell-name")?.textContent)).toEqual([
      "Add a tender",
      "Edit a tender",
      "Delete a tender",
      "Add a project",
      "Edit a project",
      "Delete a project",
    ]);
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Workflow", "Record", "Action", "Held by", "State", ""]);
  });

  it("names each workflow with its code, links its record and opens its detail", async () => {
    show();

    await screen.findByText("Add a tender");

    const first = within(rows()[0]);
    expect(first.getByRole("link", { name: "Add a tender" })).toHaveAttribute("href", "/h/h1/workflows-generated?open=g1");
    expect(first.getByText("RC-1.add")).toBeInTheDocument();
    expect(first.getByRole("link", { name: "Tenders" })).toHaveAttribute("href", "/h/h1/records?record=RC-1");
    expect(first.getByText("Add")).toHaveClass("tag", "mute");
    expect(first.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/workflows-generated?open=g1");
    expect(within(rows()[1]).getByText("Edit")).toHaveClass("tag", "mute");
    expect(within(rows()[2]).getByText("Delete")).toHaveClass("tag", "mute");
  });

  it("names the roles whose permission list carries the codes of each step", async () => {
    show();

    await screen.findByText("Add a tender");

    const heldBy = rows().map((row) => row.querySelectorAll("td")[3].textContent);
    expect(heldBy).toEqual(["Bid coordinator", "Bid coordinator", "Bid coordinator, Programme lead", "Project officer", "Project officer", "Programme lead"]);
  });

  it("marks every row Read-only and the replaced Add as Replaced by the designed workflow", async () => {
    show();

    await screen.findByText("Add a tender");

    for (const row of rows()) expect(within(row).getByText("Read-only")).toHaveClass("tag", "mute");
    const replaced = within(rows()[3]);
    expect(replaced.getByText("Replaced")).toHaveClass("tag", "warn");
    expect(replaced.getByRole("link", { name: "Register a project" })).toHaveAttribute("href", "/h/h1/workflows?open=w9");
    expect(within(rows()[0]).queryByText("Replaced")).not.toBeInTheDocument();
  });

  it("narrows the list by what is typed", async () => {
    show();
    await screen.findByText("Add a tender");

    await userEvent.type(screen.getByRole("searchbox", { name: "Search workflows" }), "project");

    expect(rows()).toHaveLength(3);
    expect(screen.queryByText("Add a tender")).not.toBeInTheDocument();
  });

  it("reads the draft's workflows, records and roles and writes nothing", async () => {
    show();
    await screen.findByText("Add a tender");

    for (const tool of ["agency_list_workflows", "agency_list_records", "agency_list_roles"]) expect(callsTo(tool)).toHaveLength(1);
    expect(vi.mocked(callTool).mock.calls.map(([, tool]) => tool).filter((tool) => /create|update|delete|propose/.test(String(tool)))).toEqual([]);
  });

  it("says so when the agency has no generated workflow", async () => {
    show({ ...hub, agency_list_workflows: { items: [{ id: "w9", code: "W-9", name: "Register a project" }] } });
    expect(await screen.findByText("No generated workflows yet. They come with the records.")).toBeInTheDocument();
  });
});
