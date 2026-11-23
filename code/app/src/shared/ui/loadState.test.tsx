import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyCard, LoadFailed, LoadingLine } from "./LoadState";

describe("LoadState", () => {
  it("draws the empty card with its words and whatever sits inside it", () => {
    render(
      <EmptyCard words="Nothing yet">
        <button type="button">Go</button>
      </EmptyCard>,
    );
    expect(screen.getByText("Nothing yet").closest(".card")).toHaveClass("empty");
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("draws the loading line as a status that says Loading unless given other words", () => {
    const { rerender } = render(<LoadingLine />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.getByRole("status").closest(".card")).toHaveClass("empty");
    rerender(<LoadingLine words="Loading forms" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading forms");
  });

  it("draws the load failure as an alert message box with an icon, a heading and the words", () => {
    render(<LoadFailed words="The list could not be loaded." />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The list could not be loaded.");
    expect(alert.closest(".card")).toHaveClass("tone-error");
    expect(alert.closest(".card")).not.toHaveClass("empty");
    expect(alert.querySelector(".message-icon svg")).toHaveAttribute("data-icon", "alert");
    expect(within(alert).getByText("Something went wrong")).toHaveClass("message-title");
  });
});

describe("LoadFailed retry", () => {
  it("offers Try again only when it is given something to run, and runs it on a press", async () => {
    const retry = vi.fn();
    const { rerender } = render(<LoadFailed words="The list could not be loaded." />);
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    rerender(<LoadFailed words="The list could not be loaded." onRetry={retry} />);
    const again = screen.getByRole("button", { name: "Try again" });
    expect(screen.getByRole("alert")).toContainElement(again);
    await userEvent.click(again);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
