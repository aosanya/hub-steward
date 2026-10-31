import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MutableRefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts } from "../data/accounts";
import type { Reply } from "../data/chatAnswer";
import { askModel } from "../data/modelChat";
import { I18nProvider } from "../i18n";
import { AskHost } from "./AskHost";
import type { Ask } from "./chatTell";

vi.mock("../data/accounts", async (importOriginal) => ({ ...(await importOriginal<object>()), listAccounts: vi.fn() }));
vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

type Pending = { text: string; signal: AbortSignal; answer: (text: string) => void };

const pending: Pending[] = [];

const slowModel = () =>
  vi.mocked(askModel).mockImplementation(
    (_hub, _account, turns, _page, _background, signal) =>
      new Promise<Reply>((done, fail) => {
        const text = turns[turns.length - 1].content;
        const abort = signal as AbortSignal;
        abort.addEventListener("abort", () => fail(new DOMException("Aborted", "AbortError")));
        pending.push({ text, signal: abort, answer: (reply) => done({ text: reply, calls: [] }) });
      }),
  );

const open = async () => {
  const asks: MutableRefObject<Ask | null> = { current: null };
  render(
    <I18nProvider initial={words}>
      <AskHost asks={asks} hubId="siaya" />
    </I18nProvider>,
  );
  await act(async () => {});
  const ask = async (text: string, settled?: () => void, shown?: string) =>
    act(async () => asks.current?.(text, undefined, undefined, settled, shown));
  return { ask };
};

const answerFirst = (text: string) => act(async () => pending[0].answer(text));

beforeEach(() => {
  localStorage.clear();
  pending.length = 0;
  vi.mocked(listAccounts).mockResolvedValue([]);
  vi.mocked(askModel).mockReset();
  slowModel();
});

describe("the chat when asks arrive while it is working", () => {
  it("lists the waiting ones and answers them one after the other", async () => {
    const { ask } = await open();
    await ask("First review.");
    await ask("Second review.");
    await ask("Third review.");

    expect(askModel).toHaveBeenCalledTimes(1);
    const waiting = screen.getByRole("list", { name: "Waiting in the chat" });
    expect(within(waiting).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Second review.", "Third review."]);

    await answerFirst("One.");
    expect(askModel).toHaveBeenCalledTimes(2);
    expect(pending[1].text).toBe("Second review.");
    expect(within(screen.getByRole("list", { name: "Waiting in the chat" })).getAllByRole("listitem")).toHaveLength(1);

    await act(async () => pending[1].answer("Two."));
    expect(pending[2].text).toBe("Third review.");
    await act(async () => pending[2].answer("Three."));

    expect(screen.queryByRole("list", { name: "Waiting in the chat" })).toBeNull();
    expect(screen.getByText("Three.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("drops one waiting ask when its cross is pressed and tells it so", async () => {
    const settled = vi.fn();
    const { ask } = await open();
    await ask("First review.");
    await ask("Second review.", settled);
    await ask("Third review.");

    await userEvent.click(screen.getByRole("button", { name: "Remove from the queue: Second review." }));
    expect(settled).toHaveBeenCalledTimes(1);

    await answerFirst("One.");
    expect(pending[1].text).toBe("Third review.");
    expect(askModel).toHaveBeenCalledTimes(2);
  });

  it("stops the running answer and clears the queue when Stop is pressed", async () => {
    const running = vi.fn();
    const waiting = vi.fn();
    const { ask } = await open();
    await ask("First review.", running);
    await ask("Second review.", waiting);

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(pending[0].signal.aborted).toBe(true);
    expect(waiting).toHaveBeenCalledTimes(1);
    expect(running).toHaveBeenCalledTimes(1);
    expect(askModel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list", { name: "Waiting in the chat" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("First review.")).toBeNull();
  });

  it("shows the short label in the queue and the thread while the model gets the full instruction", async () => {
    const { ask } = await open();
    await ask("First review.");
    await ask("Resolve this review finding with your best effort: \"G-14 has no objectives\".", undefined, "Resolve: G-14 has no objectives");

    const waiting = within(screen.getByRole("list", { name: "Waiting in the chat" }));
    expect(waiting.getByText("Resolve: G-14 has no objectives")).toBeInTheDocument();
    expect(screen.queryByText(/with your best effort/)).toBeNull();

    await answerFirst("One.");
    expect(pending[1].text).toMatch(/^Resolve this review finding with your best effort/);
    expect(screen.getByText("Resolve: G-14 has no objectives")).toBeInTheDocument();
    expect(screen.queryByText(/with your best effort/)).toBeNull();
  });
});
