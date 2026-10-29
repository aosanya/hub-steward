import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts } from "../data/accounts";
import { I18nProvider } from "../i18n";
import { askModel } from "../data/modelChat";
import type { MutableRefObject } from "react";
import { AskHost } from "./AskHost";
import type { Ask } from "./chatTell";
import { ChatColumn } from "./ChatColumn";

vi.mock("../data/accounts", async (importOriginal) => ({ ...(await importOriginal<object>()), listAccounts: vi.fn() }));
vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const openChat = async (onAttach?: (fileName: string) => void, onChanged?: (page: string) => void) => {
  render(
    <I18nProvider initial={words}>
      <ChatColumn hubId="siaya" page="status" rail={false} onToggleRail={() => {}} onAttach={onAttach} onChanged={onChanged} />
    </I18nProvider>,
  );
  await act(async () => {});
};

const picker = () => document.querySelector("input[type=file]") as HTMLInputElement;

beforeEach(() => {
  vi.mocked(listAccounts).mockResolvedValue([]);
});

describe("the chat message box", () => {
  it("draws the message box as a card holding the text, the attach button and the round send button at its bottom", async () => {
    await openChat();

    const card = screen.getByRole("textbox", { name: "Write a message" }).closest(".composer") as HTMLElement;
    const bar = card.querySelector(".composer-bar") as HTMLElement;
    expect(card.closest("form")).toHaveClass("chat-input");
    expect(bar.querySelector(".chat-attach")).toBe(screen.getByRole("button", { name: "Attach a file" }));
    expect(bar.lastElementChild).toBe(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("chat-send");
  });

  it("opens the file picker when Attach is pressed", async () => {
    await openChat();
    const opened = vi.spyOn(picker(), "click");

    await userEvent.setup().click(screen.getByRole("button", { name: "Attach a file" }));

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("hands the chosen file name to onAttach and clears the picker so the same file can be chosen again", async () => {
    const onAttach = vi.fn();
    await openChat(onAttach);

    await userEvent.setup().upload(picker(), new File(["x"], "rota.pdf", { type: "application/pdf" }));

    expect(onAttach.mock.calls).toEqual([["rota.pdf"]]);
    expect(picker().value).toBe("");
  });

  it("keeps the picker out of the tab order and the reading order", async () => {
    await openChat();

    expect(picker()).toHaveAttribute("tabindex", "-1");
    expect(picker()).toHaveAttribute("aria-hidden", "true");
  });

  it("lets the file be chosen when no onAttach is given", async () => {
    await openChat();

    await userEvent.setup().upload(picker(), new File(["x"], "rota.pdf"));

    expect(picker().value).toBe("");
  });
});

describe("the chat after the model closed a subject", () => {
  it("keeps the manager's message marked as the start of the new subject, so older messages stop being sent", async () => {
    localStorage.clear();
    vi.mocked(askModel).mockResolvedValue({ text: "Here are goals.", calls: [], newTopic: true });
    await openChat();

    await userEvent.setup().type(screen.getByRole("textbox", { name: "Write a message" }), "Generate the goals{Enter}");
    await screen.findByText("Here are goals.");

    const saved = JSON.parse(localStorage.getItem("chat.turns.siaya") ?? "[]");
    expect(saved[0]).toEqual({ role: "user", content: "Generate the goals", newTopic: true });
    expect(saved[1].newTopic).toBeUndefined();
  });
});

describe("the chat after the model created something", () => {
  it("tells the page which page changed so it can reload", async () => {
    localStorage.clear();
    vi.mocked(askModel).mockResolvedValue({ text: "I created 3 goals.", calls: [], changed: "goals" });
    const onChanged = vi.fn();
    await openChat(undefined, onChanged);

    await userEvent.setup().type(screen.getByRole("textbox", { name: "Write a message" }), "Generate the goals{Enter}");
    await screen.findByText("I created 3 goals.");

    expect(onChanged.mock.calls).toEqual([["goals"]]);
  });
});

const asking = async (page: string, answer: { text: string; calls: never[]; changed?: string }, callbacks: { afterChange?: () => void; settled?: () => void; background?: string; text?: string } = {}) => {
  localStorage.clear();
  vi.mocked(askModel).mockClear();
  vi.mocked(askModel).mockResolvedValue(answer);
  const asks: MutableRefObject<Ask | null> = { current: null };
  render(
    <I18nProvider initial={words}>
      <AskHost asks={asks} hubId="siaya" page={page} />
    </I18nProvider>,
  );
  await act(async () => {});
  await act(async () => asks.current?.(callbacks.text ?? "Resolve it.", callbacks.background, callbacks.afterChange, callbacks.settled));
  await screen.findByText(answer.text);
};

describe("the chat after a page asked it something and gave a callback for a change", () => {
  it("calls it when the answer changed the draft", async () => {
    const afterChange = vi.fn();
    await asking("review-goals", { text: "Added O-1.", calls: [], changed: "review-goals" }, { afterChange });
    expect(afterChange).toHaveBeenCalledTimes(1);
  });

  it("calls the settled callback after the answer, changed or not", async () => {
    const settled = vi.fn();
    await asking("review-goals", { text: "Nothing to do.", calls: [] }, { settled });
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("does not call it when nothing changed", async () => {
    const afterChange = vi.fn();
    await asking("review-goals", { text: "I have no tool for that.", calls: [] }, { afterChange });
    expect(afterChange).not.toHaveBeenCalled();
  });
});

describe("the chat after a page asked it something with background", () => {
  it("shows only the sentence in the thread and hands the background to the model for that turn", async () => {
    await asking("objectives", { text: "Reviewed.", calls: [] }, { text: "Review the objectives.", background: "goals (1):\n{\"id\":\"g1\"}" });

    expect(screen.getByText("Review the objectives.")).toBeInTheDocument();
    expect(screen.queryByText(/goals \(1\)/)).toBeNull();
    const call = vi.mocked(askModel).mock.calls[0];
    expect(call[2]).toEqual([{ role: "user", content: "Review the objectives." }]);
    expect(call[3]).toBe("objectives");
    expect(call[4]).toBe("goals (1):\n{\"id\":\"g1\"}");
    expect(call[5]).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(localStorage.getItem("chat.turns.siaya") ?? "[]")[0]).toEqual({ role: "user", content: "Review the objectives." });
  });

  it("gives an ordinary typed message no background", async () => {
    localStorage.clear();
    vi.mocked(askModel).mockClear();
    vi.mocked(askModel).mockResolvedValue({ text: "Fine.", calls: [] });
    await openChat();

    await userEvent.setup().type(screen.getByRole("textbox", { name: "Write a message" }), "Hello{Enter}");
    await screen.findByText("Fine.");

    expect(vi.mocked(askModel).mock.calls[0][4]).toBe("");
  });
});
