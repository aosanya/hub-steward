import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AmendDraft } from "./AmendDraft";
import { editKey, type Edits } from "./amend";
import type { EarlierStep } from "./api";

const earlier: EarlierStep[] = [
  {
    stepTitle: "Report a referral",
    roleName: "Volunteer",
    answers: [
      { prompt: "Reason", answer: "Needs a clinic check" },
      { prompt: "Minutes to the clinic", answer: "25" },
    ],
  },
];

const show = (edits: Edits = {}) => {
  const onChange = vi.fn();
  render(<AmendDraft earlier={earlier} edits={edits} onChange={onChange} />);
  return onChange;
};

afterEach(cleanup);

describe("the earlier work shown for amending", () => {
  it("shows each step's title, role, prompts and answers", () => {
    show();
    expect(screen.getByText("Report a referral")).toBeInTheDocument();
    expect(screen.getByText(/Volunteer/)).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Needs a clinic check")).toBeInTheDocument();
    expect(screen.getByText("Minutes to the clinic")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("offers Change and Strike out on every answer", () => {
    show();
    expect(screen.getAllByRole("button", { name: "Change" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Strike out" })).toHaveLength(2);
  });

  it("shows no text box and no struck text before anything is edited", () => {
    show();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector("del")).toBeNull();
  });
});

describe("changing an answer", () => {
  it("starts an edit at the original text, not struck", async () => {
    const onChange = show();
    await userEvent.click(screen.getAllByRole("button", { name: "Change" })[1]);
    expect(onChange).toHaveBeenCalledWith({ [editKey(0, 1)]: { text: "25", struck: false } });
  });

  it("keeps the edits already made when it starts another", async () => {
    const onChange = show({ [editKey(0, 0)]: { text: "Needs a dentist", struck: false } });
    await userEvent.click(screen.getAllByRole("button", { name: "Change" })[1]);
    expect(onChange).toHaveBeenCalledWith({
      [editKey(0, 0)]: { text: "Needs a dentist", struck: false },
      [editKey(0, 1)]: { text: "25", struck: false },
    });
  });

  it("shows an edited answer in a text box labelled by its prompt, holding the edit", () => {
    show({ [editKey(0, 0)]: { text: "Needs a dentist", struck: false } });
    expect(screen.getByLabelText("Reason")).toHaveValue("Needs a dentist");
  });

  it("reports the new text as the person types", () => {
    const onChange = show({ [editKey(0, 0)]: { text: "Needs a clinic check", struck: false } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Needs a dentist" } });
    expect(onChange).toHaveBeenCalledWith({ [editKey(0, 0)]: { text: "Needs a dentist", struck: false } });
  });

  it("leaves the other answers as plain text", () => {
    show({ [editKey(0, 0)]: { text: "Needs a dentist", struck: false } });
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByText("25")).toBeInTheDocument();
  });
});

describe("striking an answer out", () => {
  it("starts a struck edit holding the original text", async () => {
    const onChange = show();
    await userEvent.click(screen.getAllByRole("button", { name: "Strike out" })[0]);
    expect(onChange).toHaveBeenCalledWith({ [editKey(0, 0)]: { text: "Needs a clinic check", struck: true } });
  });

  it("shows a struck answer with a line through it", () => {
    show({ [editKey(0, 1)]: { text: "25", struck: true } });
    const struck = document.querySelector("del");
    expect(struck).not.toBeNull();
    expect(struck).toHaveTextContent("25");
  });

  it("offers Keep in place of Strike out on a struck answer", () => {
    show({ [editKey(0, 1)]: { text: "25", struck: true } });
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Strike out" })).toHaveLength(1);
  });

  it("removes the edit when the answer is kept again", async () => {
    const onChange = show({
      [editKey(0, 0)]: { text: "Needs a dentist", struck: false },
      [editKey(0, 1)]: { text: "25", struck: true },
    });
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(onChange).toHaveBeenCalledWith({ [editKey(0, 0)]: { text: "Needs a dentist", struck: false } });
  });

  it("keeps the answer's own row the one that is struck", () => {
    show({ [editKey(0, 1)]: { text: "25", struck: true } });
    const row = screen.getByText("Minutes to the clinic").closest("div")!;
    expect(within(row).getByText("25").closest("del")).not.toBeNull();
  });
});
