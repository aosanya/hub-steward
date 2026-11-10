import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { ChatAskCtx } from "../shell/chatTell";
import { EnhanceTool, RowTools } from "./RowTools";

const words = { en: { "suggest.ask": "Ask", "suggest.send": "Send", "enhance.button": "Enhance" } };

const show = (ask: (...args: unknown[]) => void, ui: React.ReactElement) =>
  render(
    <I18nProvider initial={words}>
      <ChatAskCtx.Provider value={ask}>{ui}</ChatAskCtx.Provider>
    </I18nProvider>,
  );

describe("RowTools", () => {
  it("shows its children and an Ask button that opens and closes the question box", async () => {
    show(vi.fn(), <RowTools question={(t) => t}>child</RowTools>);
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(ask).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox")).toBeNull();
    await userEvent.click(ask);
    expect(ask).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await userEvent.click(ask);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("has no Ask button when asking is off", () => {
    show(vi.fn(), <RowTools question={(t) => t} asking={false}>child</RowTools>);
    expect(screen.queryByRole("button", { name: "Ask" })).toBeNull();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("keeps Send off until something is typed", async () => {
    show(vi.fn(), <RowTools question={(t) => t}>child</RowTools>);
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "  ");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("asks the chat the trimmed question with the background and clears the box", async () => {
    const ask = vi.fn();
    show(ask, <RowTools question={(t) => `About it: ${t}`} background={async () => "the background"}>child</RowTools>);
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    await userEvent.type(screen.getByRole("textbox"), " why? ");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith("About it: why?", "the background"));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("still asks, without a background, when the background cannot be read", async () => {
    const ask = vi.fn();
    show(ask, <RowTools question={(t) => t} background={() => Promise.reject(new Error("no"))}>child</RowTools>);
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    await userEvent.type(screen.getByRole("textbox"), "why{Enter}");
    await waitFor(() => expect(ask).toHaveBeenCalledWith("why", undefined));
  });
});

describe("EnhanceTool", () => {
  it("asks the chat its message with the background, the change callback and the shown words", async () => {
    const ask = vi.fn();
    const onChanged = vi.fn();
    show(ask, <EnhanceTool message="Fix it" shown="Fixing it" background={async () => "around"} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: "Enhance" }));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    const call = ask.mock.calls[0];
    expect(call[0]).toBe("Fix it");
    expect(call[1]).toBe("around");
    expect(call[2]).toBe(onChanged);
    expect(call[4]).toBe("Fixing it");
  });

  it("stays busy until the chat settles the ask, then frees the button", async () => {
    let settle: () => void = () => {};
    const ask = vi.fn((_m: unknown, _b: unknown, _c: unknown, settled: () => void) => {
      settle = settled;
    });
    show(ask, <EnhanceTool message="Fix it" />);
    const button = screen.getByRole("button", { name: "Enhance" });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");
    act(() => settle());
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("passes no background when it cannot be read", async () => {
    const ask = vi.fn();
    show(ask, <EnhanceTool message="Fix it" background={() => Promise.reject(new Error("no"))} />);
    await userEvent.click(screen.getByRole("button", { name: "Enhance" }));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(ask.mock.calls[0][1]).toBeUndefined();
  });
});
