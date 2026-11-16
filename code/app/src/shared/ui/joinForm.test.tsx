import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinForm, wholeQuantity } from "./JoinForm";

const show = (send = vi.fn().mockResolvedValue(undefined), current?: number, unit = "bag") => {
  render(
    <JoinForm label="How many" unit={unit} action="Join" current={current} send={send}>
      <p>Terms</p>
    </JoinForm>,
  );
  return send;
};

describe("wholeQuantity", () => {
  it.each([
    ["2", 2],
    [" 40 ", 40],
    ["1,200", 1200],
  ])("reads %j as %i", (text, expected) => {
    expect(wholeQuantity(text)).toBe(expected);
  });

  it.each(["", "0", "-1", "two", "1.5", "2 bags"])("refuses %j", (text) => {
    expect(wholeQuantity(text)).toBeNaN();
  });
});

describe("JoinForm", () => {
  it("shows what it is given above one field and the action", () => {
    show();
    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByLabelText("How many")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
  });

  it("starts from the current quantity", () => {
    show(undefined, 7);
    expect(screen.getByLabelText("How many")).toHaveValue("7");
  });

  it("sends the whole number she typed", async () => {
    const send = show();
    await userEvent.type(screen.getByLabelText("How many"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(send).toHaveBeenCalledWith(12);
  });

  it("names the unit in the refusal and sends nothing", async () => {
    const send = show(undefined, undefined, "litre");
    await userEvent.type(screen.getByLabelText("How many"), "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Give the litres as a whole number.")).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps what she typed and says so when sending fails", async () => {
    const send = show(vi.fn().mockRejectedValue(new Error("no")));
    await userEvent.type(screen.getByLabelText("How many"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("Your bags were not sent. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("How many")).toHaveValue("3");
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("clears the refusal once a good number goes through", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Give the bags as a whole number.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("How many"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.queryByText("Give the bags as a whole number.")).not.toBeInTheDocument();
  });
});
