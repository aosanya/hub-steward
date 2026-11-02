import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { english } from "../pages/spec/profileTesting";
import { ChatAskCtx } from "../shell/chatTell";
import { RowActions, type RowState } from ".";
import { rowBars } from "./rowBar.test-support";

const words = { en: { ...english.en, "review.undo": "Reopen" } };

type Show = {
  hasTool?: boolean;
  state?: RowState;
  busy?: "applying" | "settling";
  onApply?: () => void;
  onDismiss?: () => void;
  onUndo?: () => void;
  onDetails?: () => void;
  onComment?: () => void;
  commenting?: boolean;
  ask?: (text: string) => void;
};

const show = (options: Show = {}) =>
  render(
    <I18nProvider initial={words}>
      <ChatAskCtx.Provider value={options.ask ?? (() => {})}>
        <RowActions
          question={(text) => `About it: ${text}`}
          background={async () => "the background"}
          hasTool={options.hasTool ?? true}
          enhance={{ message: "Please resolve it", shown: "Resolving it" }}
          state={options.state}
          busy={options.busy}
          onApply={options.onApply ?? (() => {})}
          onDismiss={options.onDismiss ?? (() => {})}
          onUndo={options.onUndo}
          onDetails={options.onDetails}
          onComment={options.onComment}
          commenting={options.commenting}
        />
      </ChatAskCtx.Provider>
    </I18nProvider>,
  );

describe("the row action bar", () => {
  it("draws Ask, Apply, Details and Dismiss, in that order, for a row with a change of its own", () => {
    const { container } = show({ onDetails: () => {} });

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Apply", "Details", "Dismiss"]]);
  });

  it("draws the note button between Apply and Details when the screen passes a way to comment", () => {
    const { container } = show({ onDetails: () => {}, onComment: () => {} });

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Apply", "Add a note", "Details", "Dismiss"]]);
  });

  it("draws Enhance with a wand in place of Apply for a row with no change of its own", () => {
    const { container } = show({ hasTool: false, onDetails: () => {} });

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Enhance", "Details", "Dismiss"]]);
    expect(screen.getByRole("button", { name: "Enhance" }).querySelector("svg")).not.toBeNull();
  });

  it("draws no Details button when the screen passes none", () => {
    const { container } = show();

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Apply", "Dismiss"]]);
  });

  it("leaves Apply and Dismiss out of an applied row, with no state word beside the buttons", () => {
    const { container } = show({ state: "applied", onDetails: () => {} });

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Details"]]);
    expect(screen.queryByText("Applied")).not.toBeInTheDocument();
  });

  it("leaves Ask, Apply and Dismiss out of a dismissed row and offers Reopen", () => {
    const { container } = show({ state: "dismissed", onDetails: () => {}, onUndo: () => {} });

    expect(rowBars(container)).toEqual([["Details", "Reopen"]]);
    expect(screen.queryByText("Dismissed")).not.toBeInTheDocument();
  });

  it("offers no Reopen to a dismissed row whose screen passes no way back", () => {
    const { container } = show({ state: "dismissed", onDetails: () => {} });

    expect(rowBars(container)).toEqual([["Details"]]);
  });

  it("disables Apply and Dismiss while a change is being made, and marks Apply busy", () => {
    show({ busy: "applying" });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveAttribute("aria-busy", "false");
  });

  it("marks Dismiss busy and disables Apply while a status is being set", () => {
    show({ busy: "settling" });

    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("hands each press to its own handler and to no other", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    const onDetails = vi.fn();
    const onComment = vi.fn();
    show({ onApply, onDismiss, onDetails, onComment });

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect([onApply, onDismiss, onDetails, onComment].map((handler) => handler.mock.calls.length)).toEqual([1, 0, 0, 0]);
    await user.click(screen.getByRole("button", { name: "Add a note" }));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect([onApply, onDismiss, onDetails, onComment].map((handler) => handler.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it("marks the note button expanded while the screen says it is open", () => {
    show({ onComment: () => {}, commenting: true });

    expect(screen.getByRole("button", { name: "Add a note" })).toHaveAttribute("aria-expanded", "true");
  });

  it("sends Enhance to the chat with the message and the background", async () => {
    const user = userEvent.setup();
    const ask = vi.fn();
    show({ hasTool: false, ask });

    await user.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(ask.mock.calls[0][0]).toBe("Please resolve it");
    expect(ask.mock.calls[0][1]).toBe("the background");
  });

  it("sends the typed question to the chat", async () => {
    const user = userEvent.setup();
    const ask = vi.fn();
    show({ ask });

    await user.click(screen.getByText("Ask the chat about this"));
    await user.type(screen.getByPlaceholderText("Ask the chat about this"), "Why?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(ask).toHaveBeenCalledWith("About it: Why?", "the background"));
  });
});
