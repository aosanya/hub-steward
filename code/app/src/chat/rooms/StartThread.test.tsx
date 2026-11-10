import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartThread } from "./StartThread";

describe("start a thread", () => {
  it("shows only the button until it is tapped", async () => {
    render(<StartThread onStart={vi.fn()} />);
    expect(screen.queryByLabelText("What is the thread about?")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start a thread" }));
    expect(screen.getByLabelText("What is the thread about?")).toBeInTheDocument();
  });

  it("cannot start with a blank subject and starts with the trimmed one", async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    render(<StartThread onStart={onStart} />);
    await userEvent.click(screen.getByRole("button", { name: "Start a thread" }));
    const start = screen.getByRole("button", { name: "Start" });
    expect(start).toBeDisabled();
    await userEvent.type(screen.getByLabelText("What is the thread about?"), "  Seed delivery  ");
    await userEvent.click(start);
    expect(onStart).toHaveBeenCalledWith("Seed delivery");
  });

  it("says the thread was not started when the call fails, and tries again", async () => {
    const onStart = vi.fn().mockRejectedValueOnce(new Error("no")).mockResolvedValueOnce(undefined);
    render(<StartThread onStart={onStart} bare />);
    await userEvent.click(screen.getByRole("button", { name: "Start a thread" }));
    await userEvent.type(screen.getByLabelText("What is the thread about?"), "Seed delivery");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("The thread was not started. Try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("The thread was not started. Try again.")).not.toBeInTheDocument();
  });
});
