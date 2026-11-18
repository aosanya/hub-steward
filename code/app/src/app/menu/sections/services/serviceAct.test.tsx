import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceAct } from "./ServicePage";

describe("ServiceAct tone", () => {
  it("looks as it did with no tone: an accent act, or a quiet footer item", () => {
    render(
      <>
        <ServiceAct label="Edit" onClick={() => undefined} />
        <ServiceAct label="Withdraw" quiet onClick={() => undefined} />
      </>,
    );

    expect(screen.getByRole("button", { name: "Edit" }).className).toBe("sec-act");
    expect(screen.getByRole("button", { name: "Withdraw" }).className).toBe("sec-foot-item");
  });

  it("carries the danger tone as an extra class and still calls and disables as before", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<ServiceAct label="Refuse" tone="danger" onClick={onClick} />);

    expect(screen.getByRole("button", { name: "Refuse" })).toHaveClass("sec-act", "danger");
    await userEvent.click(screen.getByRole("button", { name: "Refuse" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<ServiceAct label="Refuse" tone="danger" disabled onClick={onClick} />);
    expect(screen.getByRole("button", { name: "Refuse" })).toBeDisabled();
  });
});
