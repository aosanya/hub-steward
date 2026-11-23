import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, renderView } from "../spec/usersTesting";
import { RecordsView } from "./RecordsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const live = (code: string, name: string) => ({ code, name, form_name: name, can_add_rows: true, questions: [{ prompt: "Title", answer_type: "free_text", required: true }] });

const generated = (id: string, code: string, name: string, more: Record<string, unknown> = {}) => ({ id, code, name, generated: true, generated_for: code.split(".")[0], ...more });

const hub = {
  agency_list_live_records: { items: [live("RC-1", "Tenders"), live("RC-2", "Projects")] },
  agency_list_live_record_rows: { items: [] },
  agency_list_workflows: {
    items: [
      { id: "w9", code: "W-9", name: "Register a project" },
      generated("g1", "RC-1.add", "Add a tender"),
      generated("g2", "RC-1.edit", "Edit a tender"),
      generated("g3", "RC-1.delete", "Delete a tender"),
      generated("g4", "RC-2.add", "Add a project", { replaced_by: "W-9" }),
      generated("g5", "RC-2.edit", "Edit a project"),
    ],
  },
  agency_list_records: {
    items: [
      { id: "rec1", code: "RC-1", name: "Tenders", role_id: "r1" },
      { id: "rec2", code: "RC-2", name: "Projects", role_id: "r2", delete_role_id: "r3" },
    ],
  },
  agency_list_roles: { items: [{ id: "r1", name: "Bid coordinator" }, { id: "r2", name: "Project officer" }, { id: "r3", name: "Programme lead" }] },
};

const open = (code: string, replies: Parameters<typeof answering>[0] = hub) => {
  answering(replies);
  return renderView("records", RecordsView, "?record=" + code);
};

const card = async (name: string) => within((await screen.findByRole("heading", { level: 2, name })).closest("section") as HTMLElement);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("an open record's card of generated workflows", () => {
  it("lists its Add, Edit and Delete with the role that holds each, Read-only and Open", async () => {
    open("RC-1");

    const list = await card("Workflows generated from Tenders");
    const rows = list.getAllByRole("row").slice(1);

    expect(rows.map((row) => row.querySelectorAll("td")[0].textContent)).toEqual(["Add", "Edit", "Delete"]);
    expect(rows.map((row) => row.querySelectorAll("td")[1].textContent)).toEqual(["Bid coordinator", "Bid coordinator", "Bid coordinator"]);
    for (const row of rows) expect(within(row).getByText("Read-only")).toHaveClass("tag", "mute");
    expect(within(rows[0]).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/workflows-generated?open=g1");
  });

  it("marks a replaced Add, links the designed workflow and marks a missing Delete with no Open", async () => {
    open("RC-2");

    const list = await card("Workflows generated from Projects");
    const rows = list.getAllByRole("row").slice(1);

    expect(within(rows[0]).getByText("Replaced")).toHaveClass("tag", "warn");
    expect(within(rows[0]).getByRole("link", { name: "Register a project" })).toHaveAttribute("href", "/h/h1/workflows?open=w9");
    expect(within(rows[1]).getByText("Read-only")).toBeInTheDocument();
    expect(rows[2].querySelectorAll("td")[1].textContent).toBe("Programme lead");
    expect(within(rows[2]).getByText("Missing")).toHaveClass("tag", "bad");
    expect(within(rows[2]).queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });

  it("draws no card while the agency has no generated workflow, or when they cannot be read", async () => {
    open("RC-1", { ...hub, agency_list_workflows: { items: [] } });
    await screen.findByRole("heading", { level: 1, name: "Tenders" });
    expect(screen.queryByRole("heading", { level: 2, name: /^Workflows generated from/ })).not.toBeInTheDocument();
  });

  it("draws no card when the workflows cannot be read, and still shows the rows", async () => {
    open("RC-1", { ...hub, agency_list_workflows: new Error("down") });
    await screen.findByRole("heading", { level: 1, name: "Tenders" });
    expect(screen.queryByRole("heading", { level: 2, name: /^Workflows generated from/ })).not.toBeInTheDocument();
  });
});
