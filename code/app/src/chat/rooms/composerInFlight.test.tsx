import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./Composer";

describe("room composer while a message is on its way", () => {
  it("sends once however many times Send and Enter are pressed, and is ready again afterwards", async () => {
    let finish: () => void = () => undefined;
    const onSend = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<Composer placeholder="Write to the group" onSend={onSend} />);
    const field = screen.getByLabelText("Write to the group");
    await userEvent.type(field, "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Sending" })).toBeDisabled();
    await userEvent.type(field, "{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(field).toHaveValue(""));
    await userEvent.type(field, "Again");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });
});
