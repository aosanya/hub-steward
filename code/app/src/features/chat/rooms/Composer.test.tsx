import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./Composer";

describe("room composer", () => {
  it("cannot send an empty or blank message", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer placeholder="Write to the group" onSend={onSend} />);
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Write to the group"), "   ");
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Write to the group"), "{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends the trimmed words with the button and clears the field", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer placeholder="Write to the group" onSend={onSend} />);
    const field = screen.getByLabelText("Write to the group");
    await userEvent.type(field, "  Maize is ready  ");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("Maize is ready");
    await waitFor(() => expect(field).toHaveValue(""));
    expect(field).toHaveFocus();
  });

  it("sends with Enter", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer placeholder="Write to the group" onSend={onSend} />);
    await userEvent.type(screen.getByLabelText("Write to the group"), "Hello{Enter}");
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("keeps the words and says so when the send is refused, then clears the line on the next try", async () => {
    const onSend = vi.fn().mockRejectedValueOnce(new Error("no")).mockResolvedValueOnce(undefined);
    render(<Composer placeholder="Write to the group" onSend={onSend} />);
    const field = screen.getByLabelText("Write to the group");
    await userEvent.type(field, "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Your message was not sent. Try again.")).toBeInTheDocument();
    expect(field).toHaveValue("Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.queryByText("Your message was not sent. Try again.")).not.toBeInTheDocument());
    expect(field).toHaveValue("");
  });
});
