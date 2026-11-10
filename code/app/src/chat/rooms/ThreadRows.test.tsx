import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomThread } from "./api";
import { ThreadRows } from "./ThreadRows";
import { timeOf } from "./time";

const thread = (over: Partial<RoomThread>): RoomThread => ({
  id: "t1",
  label: "Seed delivery",
  audience: "group",
  requestedBy: "",
  declined: false,
  unread: 0,
  lastMessageAt: "",
  preview: "",
  ...over,
});

describe("thread rows", () => {
  it("shows the label, the preview and the time of the last message", () => {
    const at = "2026-10-28T09:12:00Z";
    render(<ThreadRows subject="grace" threads={[thread({ preview: "Trucks arrive Friday", lastMessageAt: at })]} onOpen={vi.fn()} />);
    expect(screen.getByText("Seed delivery")).toBeInTheDocument();
    expect(screen.getByText("Trucks arrive Friday")).toBeInTheDocument();
    expect(screen.getByText(timeOf(at))).toBeInTheDocument();
  });

  it("counts unread messages and shows no count at zero", () => {
    render(
      <ThreadRows
        subject="grace"
        threads={[thread({ id: "a", label: "Unread one", unread: 3 }), thread({ id: "b", label: "Read one", unread: 0 })]}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("says who a leaders-only thread is with, and whose request it is", () => {
    render(
      <ThreadRows
        subject="grace"
        threads={[
          thread({ id: "a", label: "Mine", audience: "leads", requestedBy: "grace" }),
          thread({ id: "b", label: "Theirs", audience: "leads", requestedBy: "otieno" }),
          thread({ id: "c", label: "Nobody asked", audience: "leads", requestedBy: "" }),
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText("Your request · with the leaders")).toBeInTheDocument();
    expect(screen.getAllByText("With the leaders")).toHaveLength(2);
  });

  it("says a declined thread is declined, whoever it is with", () => {
    render(<ThreadRows subject="grace" threads={[thread({ audience: "leads", requestedBy: "grace", declined: true })]} onOpen={vi.fn()} />);
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.queryByText(/with the leaders/i)).not.toBeInTheDocument();
  });

  it("shows no line about a group thread without a preview and opens a thread by its id", async () => {
    const onOpen = vi.fn();
    render(<ThreadRows subject="grace" threads={[thread({ id: "t9", label: "Plain" })]} onOpen={onOpen} />);
    expect(screen.queryByText("With the leaders")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Plain/ }));
    expect(onOpen).toHaveBeenCalledWith("t9");
  });
});
