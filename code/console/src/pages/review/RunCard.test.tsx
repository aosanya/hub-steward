import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { RunCard } from "./RunCard";

const words = { en: { "review.run": "Run review", "review.empty": "This draft has not been reviewed yet." } };

const show = (props: Partial<Parameters<typeof RunCard>[0]> = {}) => {
  const onRun = vi.fn();
  render(
    <I18nProvider initial={words}>
      <RunCard onRun={onRun} busy={false} refusal="" {...props} />
    </I18nProvider>,
  );
  return onRun;
};

describe("RunCard", () => {
  it("says the draft has not been reviewed and holds the Run review button", () => {
    show();
    expect(screen.getByText("This draft has not been reviewed yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run review" })).toBeEnabled();
  });

  it("keeps the button inside the card that says so", () => {
    show();
    const card = screen.getByText("This draft has not been reviewed yet.").parentElement as HTMLElement;
    expect(card).toContainElement(screen.getByRole("button", { name: "Run review" }));
  });

  it("calls onRun when the button is pressed", async () => {
    const onRun = show();
    await userEvent.click(screen.getByRole("button", { name: "Run review" }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("disables the button while busy", async () => {
    const onRun = show({ busy: true });
    const button = screen.getByRole("button", { name: "Run review" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("shows no sentence when there is no refusal", () => {
    show();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the refusal as a failed sentence under the button", () => {
    show({ refusal: "Set a default AI account first." });
    const line = screen.getByText("Set a default AI account first.");
    expect(line).toHaveClass("error");
    const button = screen.getByRole("button", { name: "Run review" });
    expect(button.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
