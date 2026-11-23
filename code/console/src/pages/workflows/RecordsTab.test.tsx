import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyRecord, type DesignChoices, type RecordDraft } from "../../data/pages/workflowDesign";
import { renderView } from "../spec/usersTesting";
import { RecordsTab } from "./RecordsTab";

const choices: DesignChoices = {
  roles: [
    { value: "r1", label: "Bid coordinator" },
    { value: "r2", label: "Programme lead" },
  ],
  workflows: [],
  designed: [
    { value: "W-9", label: "Register a project" },
    { value: "W-8", label: "Close a project" },
  ],
  cancels: [],
  lists: [],
  answerTypes: ["free_text"],
};

const record: RecordDraft = { ...emptyRecord(), key: "c1", id: "c1", name: "Tenders", roleId: "r1", itemName: "Tender", deleteRoleId: "r2", addReplacedBy: "W-9" };

const show = (onChange = vi.fn()) => {
  renderView("workflows", () => <RecordsTab records={[record]} choices={choices} onChange={onChange} />);
  return onChange;
};

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;

describe("a record in the workflow editor", () => {
  it("shows what one row is called, who edits and deletes rows, and the three workflows that may stand in", () => {
    show();

    expect(field("What one row is called")).toHaveValue("Tender");
    expect(field("Who edits rows")).toHaveValue("");
    expect(field("Who deletes rows")).toHaveValue("r2");
    expect(field("Add is replaced by")).toHaveValue("W-9");
    expect(field("Edit is replaced by")).toHaveValue("");
    expect(field("Delete is replaced by")).toHaveValue("");
  });

  it("offers every role and, first, the role that adds rows", () => {
    show();

    expect(Array.from((field("Who edits rows") as HTMLSelectElement).options).map((option) => option.textContent)).toEqual(["The role that adds rows", "Bid coordinator", "Programme lead"]);
  });

  it("offers the designed workflows and None for a replaced-by pick", () => {
    show();

    expect(Array.from((field("Edit is replaced by") as HTMLSelectElement).options).map((option) => option.textContent)).toEqual(["None", "Register a project", "Close a project"]);
  });

  it("hands each change back on the record", () => {
    const onChange = show();

    fireEvent.change(field("What one row is called"), { target: { value: "Bid" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ itemName: "Bid" })]);
    fireEvent.change(field("Who edits rows"), { target: { value: "r2" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ editRoleId: "r2" })]);
    fireEvent.change(field("Edit is replaced by"), { target: { value: "W-8" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ editReplacedBy: "W-8" })]);
    fireEvent.change(field("Delete is replaced by"), { target: { value: "W-9" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ deleteReplacedBy: "W-9" })]);
    fireEvent.change(field("Add is replaced by"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ addReplacedBy: "" })]);
    fireEvent.change(field("Who deletes rows"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ deleteRoleId: "" })]);
  });
});
