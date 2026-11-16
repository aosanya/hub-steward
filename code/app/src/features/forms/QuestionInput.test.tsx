import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormQuestion } from "./api";
import { QuestionInput } from "./QuestionInput";

const question = (over: Partial<FormQuestion>): FormQuestion => ({ id: "q1", prompt: "Question", answer_type: "text", required: false, options: [], ...over });

const empty = { text: "", options: [] as string[] };

describe("question input", () => {
  it("picks one option at a time for a single choice", async () => {
    const onChange = vi.fn();
    const q = question({ answer_type: "single_choice", options: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }] as never });
    render(<QuestionInput q={q} value={{ text: "", options: ["a"] }} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Alpha" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith({ options: ["b"] });
  });

  it("adds and removes options for a multiple choice", async () => {
    const onChange = vi.fn();
    const q = question({ answer_type: "multi_select", options: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }] as never });
    render(<QuestionInput q={q} value={{ text: "", options: ["a"] }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Beta" }));
    expect(onChange).toHaveBeenLastCalledWith({ options: ["a", "b"] });
    await userEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    expect(onChange).toHaveBeenLastCalledWith({ options: [] });
  });

  it("answers yes or no with the question's own labels, or the plain ones", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuestionInput q={question({ answer_type: "yes_no" })} value={empty} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(onChange).toHaveBeenCalledWith({ text: "no" });
    rerender(<QuestionInput q={question({ answer_type: "yes_no", yes_label: "Present", no_label: "Absent" })} value={{ text: "yes", options: [] }} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Present" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Absent" })).not.toBeChecked();
  });

  it("takes a number, a date and a time as typed fields", () => {
    const { rerender } = render(<QuestionInput q={question({ answer_type: "number", prompt: "Bags" })} value={empty} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Bags")).toHaveAttribute("type", "number");
    rerender(<QuestionInput q={question({ answer_type: "currency", prompt: "Price" })} value={empty} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Price")).toHaveAttribute("type", "number");
    rerender(<QuestionInput q={question({ answer_type: "date", prompt: "Day" })} value={empty} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Day")).toHaveAttribute("type", "date");
    rerender(<QuestionInput q={question({ answer_type: "time", prompt: "Hour" })} value={empty} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Hour")).toHaveAttribute("type", "time");
  });

  it("sends typed words for a text question and shows its error", async () => {
    const onChange = vi.fn();
    render(<QuestionInput q={question({ prompt: "Name" })} value={empty} error="Required" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Name"), "A");
    expect(onChange).toHaveBeenCalledWith({ text: "A" });
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("limits a photo to the question's number of files and says so", () => {
    const onChange = vi.fn();
    const q = question({ answer_type: "photo", prompt: "Photos", max_files: 2, require_capture: true });
    render(<QuestionInput q={q} value={{ text: "", options: [], files: ["one.jpg"] }} onChange={onChange} />);
    expect(screen.getByText("Up to 2 files")).toBeInTheDocument();
    expect(screen.getByText("Take this photo now with the camera")).toBeInTheDocument();
    expect(screen.getByText("one.jpg")).toBeInTheDocument();
    const input = screen.getByLabelText("Photos") as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/*");
    const files = ["a.jpg", "b.jpg", "c.jpg"].map((name) => new File(["x"], name));
    fireEvent.change(input, { target: { files } });
    expect(onChange).toHaveBeenCalledWith({ text: "", files: ["a.jpg", "b.jpg"] }, "Choose at most 2 files");
  });

  it("takes a single file with no limit note and no error when it fits", () => {
    const onChange = vi.fn();
    render(<QuestionInput q={question({ answer_type: "file", prompt: "Receipt" })} value={empty} onChange={onChange} />);
    expect(screen.queryByText(/Up to/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Receipt"), { target: { files: [new File(["x"], "r.pdf")] } });
    expect(onChange).toHaveBeenCalledWith({ text: "", files: ["r.pdf"] }, undefined);
  });
});
