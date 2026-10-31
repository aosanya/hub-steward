import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { ControlsView } from "./ControlsView";

vi.mock("../../wakala/mcp");

const controls = [
  { id: "c1", code: "C-1", text: "Advice only", strength: "advisory", severity: "low" },
  { id: "c2", code: "C-2", text: "Hide figures", action: "Hide the figures", on_breach: "flag", severity: "high", cond_field: "role" },
];

const open = async (search: string, more: Record<string, unknown> = {}) => {
  answerWith({
    agency_list_controls: { items: controls },
    agency_list_control_attachments: (args: Record<string, unknown>) => ({ items: args.control_id === "c2" ? [{ id: "a", target_type: "role", target_code: "R-1" }] : [] }),
    agency_create_draft: { id: "d1" },
    agency_create_control: { id: "c9" },
    agency_update_control: {},
    agency_list_workflows: { items: [{ id: "w1", name: "Escalate" }] },
    ...more,
  });
  renderPage(<ControlsView />, "controls", search);
  return userEvent.setup();
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the controls page", () => {
  it("lists each control with its strength, severity and attachments", async () => {
    const user = await open("");
    await user.click(await screen.findByRole("button", { name: "C-1 · Advice only" }));
    await user.click(screen.getByRole("button", { name: "C-2 · Hide figures" }));
    expect(screen.getByText("Enforced")).toBeInTheDocument();
    expect(screen.getByText("Advisory")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("role R-1")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add a control" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Edit" })[0]).toHaveAttribute("href", expect.stringContaining("?control=c1"));
  });

  it("lists the controls by their text whatever order they arrive in", async () => {
    await open("", { agency_list_controls: { items: [...controls].reverse() } });
    await screen.findByRole("button", { name: "C-2 · Hide figures" });
    expect(screen.getAllByRole("link", { name: "Edit" }).map((link) => link.getAttribute("href"))).toEqual([
      expect.stringContaining("?control=c1"),
      expect.stringContaining("?control=c2"),
    ]);
  });

  it("narrows the list by the search", async () => {
    const user = await open("");
    await user.type(await screen.findByRole("searchbox"), "hide");
    expect(screen.queryByRole("button", { name: "C-1 · Advice only" })).toBeNull();
    expect(screen.getByRole("button", { name: "C-2 · Hide figures" })).toBeInTheDocument();
  });

  it("shows the empty card with its button when there are none", async () => {
    await open("", { agency_list_controls: { items: [] } });
    expect(await screen.findByText("No controls yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add a control" })).toHaveLength(2);
  });

  it("saves a new control straight to the draft without approval", async () => {
    const user = await open("?add=control");
    await user.type(await screen.findByRole("textbox", { name: "Text" }), "  Check it ");
    await user.type(screen.getByRole("textbox", { name: "Action" }), "Hold");
    await user.selectOptions(screen.getByRole("combobox", { name: "Severity" }), "medium");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_control")).toHaveLength(1));
    expect(callsOf("agency_create_control")[0]).toMatchObject({ text: "Check it", action: "Hold", severity: "medium" });
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("offers the workflow choice only when the action runs a workflow", async () => {
    const user = await open("?add=control");
    await screen.findByRole("textbox", { name: "Text" });
    expect(screen.queryByRole("combobox", { name: "Workflow to run" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Action" }), "run_workflow");
    expect(await screen.findByRole("option", { name: "Escalate" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Workflow to run" }), "w1");
    await user.type(screen.getByRole("textbox", { name: "Text" }), "Escalate it");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_control")).toHaveLength(1));
    expect(callsOf("agency_create_control")[0]).toMatchObject({ workflow_id: "w1" });
  });

  it("asks for the text and writes nothing without it", async () => {
    const user = await open("?add=control");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required: Text")).toBeInTheDocument();
    expect(callsOf("agency_create_control")).toEqual([]);
  });

  it("says so when the draft refuses the control", async () => {
    const user = await open("?add=control", { agency_create_control: () => { throw new Error("no"); } });
    await user.type(await screen.findByRole("textbox", { name: "Text" }), "Check it");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("edits a control keeping the fields the table does not show", async () => {
    const user = await open("?control=c2");
    const text = await screen.findByRole("textbox", { name: "Text" });
    expect(text).toHaveValue("Hide figures");
    await user.clear(text);
    await user.type(text, "Hide all figures");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_update_control")).toHaveLength(1));
    expect(callsOf("agency_update_control")[0]).toMatchObject({ control_id: "c2", text: "Hide all figures", cond_field: "role", on_breach: "flag" });
  });
});
