import { render as mount, screen, waitFor } from "@testing-library/react";
import { useState, type ComponentProps, type ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { commentFinding } from "../../data/reviewApi";
import { FindingNotes } from "./FindingNotes";
import { comment, finding } from "./reviewFixtures";

vi.mock("../../data/reviewApi");

const saveButton = () => screen.getByRole("button", { name: "review.commentSave" });
const box = () => screen.getByRole("textbox", { name: "review.comment" });
const control = () => screen.getByRole("button", { name: "review.comment" });
const isOpen = () => screen.queryByRole("textbox", { name: "review.comment" }) !== null;

type NotesProps = Omit<ComponentProps<typeof FindingNotes>, "open" | "onClose">;

function Harness(props: NotesProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((now) => !now)}>
        review.comment
      </button>
      <FindingNotes {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const render = (ui: ReactElement<NotesProps>) => mount(ui);

describe("the notes on a finding", () => {
  beforeEach(() => {
    vi.mocked(commentFinding).mockReset();
  });

  it("lists the comments with their authors, oldest first, whatever order they arrive in", () => {
    const later = comment({ id: "c-2", author: "Steward", body: "Second note", created_at: "2026-10-31T10:00:00Z" });
    const earlier = comment({ id: "c-1", author: "Designer", body: "First note", created_at: "2026-10-31T09:00:00Z" });
    render(<Harness hubId="h1" finding={finding({ comments: [later, earlier] })} onFinding={() => {}} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Designer First note");
    expect(items[1]).toHaveTextContent("Steward Second note");
  });

  it("shows only the Add a note control when the finding has no comments", () => {
    render(<Harness hubId="h1" finding={finding()} onFinding={() => {}} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(control()).toBeInTheDocument();
  });

  it("keeps the box closed until the control is opened", async () => {
    render(<Harness hubId="h1" finding={finding()} onFinding={() => {}} />);
    expect(isOpen()).toBe(false);
    await userEvent.click(control());
    expect(isOpen()).toBe(true);
  });

  it("saves the trimmed text, hands back the finding with the saved comment appended, then clears and closes the box", async () => {
    const existing = comment();
    const saved = comment({ id: "c-9", author: "Steward", body: "Checked with the owner", created_at: "2026-10-31T11:00:00Z" });
    vi.mocked(commentFinding).mockResolvedValue(saved);
    const onFinding = vi.fn();
    const current = finding({ comments: [existing] });
    render(<Harness hubId="h1" finding={current} onFinding={onFinding} />);
    await userEvent.click(control());
    await userEvent.type(box(), "  Checked with the owner  ");
    await userEvent.click(saveButton());
    await waitFor(() => expect(onFinding).toHaveBeenCalledTimes(1));
    expect(commentFinding).toHaveBeenCalledWith("h1", "f-1", "Checked with the owner");
    expect(onFinding).toHaveBeenCalledWith({ ...current, comments: [existing, saved] });
    expect(isOpen()).toBe(false);
  });

  it("cannot save a blank note", async () => {
    render(<Harness hubId="h1" finding={finding()} onFinding={() => {}} />);
    await userEvent.click(control());
    expect(saveButton()).toBeDisabled();
    await userEvent.type(box(), "   ");
    expect(saveButton()).toBeDisabled();
    await userEvent.type(box(), "x");
    expect(saveButton()).toBeEnabled();
    expect(commentFinding).not.toHaveBeenCalled();
  });

  it("disables Save while the note is being saved", async () => {
    let finish: (value: ReturnType<typeof comment>) => void = () => {};
    vi.mocked(commentFinding).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<Harness hubId="h1" finding={finding()} onFinding={() => {}} />);
    await userEvent.click(control());
    await userEvent.type(box(), "Slow one");
    await userEvent.click(saveButton());
    expect(saveButton()).toBeDisabled();
    expect(commentFinding).toHaveBeenCalledTimes(1);
    finish(comment());
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it("keeps the typed text and shows the sentence when the save fails", async () => {
    vi.mocked(commentFinding).mockRejectedValue(new Error("the finding is gone"));
    const onFinding = vi.fn();
    render(<Harness hubId="h1" finding={finding()} onFinding={onFinding} />);
    await userEvent.click(control());
    await userEvent.type(box(), "Keep me");
    await userEvent.click(saveButton());
    const line = await screen.findByText("the finding is gone");
    expect(line).toHaveClass("error");
    expect(box()).toHaveValue("Keep me");
    expect(onFinding).not.toHaveBeenCalled();
    expect(saveButton()).toBeEnabled();
  });

  it("falls back to the failed-save string when the error carries no sentence", async () => {
    vi.mocked(commentFinding).mockRejectedValue("no");
    render(<Harness hubId="h1" finding={finding()} onFinding={() => {}} />);
    await userEvent.click(control());
    await userEvent.type(box(), "Keep me");
    await userEvent.click(saveButton());
    expect(await screen.findByText("review.commentFailed")).toHaveClass("error");
    expect(box()).toHaveValue("Keep me");
  });
});
