import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Suggestion, SuggestionsFill } from "../../data/chatAnswer";
import { applySuggestion } from "../../data/chatSuggestions";
import { I18nProvider } from "../../i18n";
import { ChatAskCtx, ChatTellCtx } from "../../shell/chatTell";
import { ConsoleCtx } from "../../shell/context";
import { rowBars } from "../../ui/rowBar.test-support";
import { english, hubRow } from "../spec/profileTesting";
import { SuggestionsPanel } from "./SuggestionsPanel";

vi.mock("../../data/chatSuggestions", () => ({ applySuggestion: vi.fn() }));
vi.mock("../../data/findingBackground", () => ({ findingBackground: async () => "the background" }));

const change: Suggestion = {
  title: "Rename O-15",
  detail: "It repeats O-22.",
  tool: "agency_update_objective",
  arguments: { objective_id: "o15" },
  then: [],
};

const advice: Suggestion = { ...change, title: "Think about a measure", detail: "Nothing measures it.", tool: "" };

const fill = (...items: Suggestion[]): SuggestionsFill => ({ page: "goals", summary: "", items });

const show = (
  items: SuggestionsFill,
  options: { onDetails?: (item: Suggestion) => void; refreshMenu?: () => void; tell?: (text: string) => void } = {},
) =>
  render(
    <I18nProvider initial={english}>
      <ChatAskCtx.Provider value={() => {}}>
        <ChatTellCtx.Provider value={options.tell ?? (() => {})}>
          <ConsoleCtx.Provider
            value={{ hub: hubRow, page: "goals", setBadges: () => {}, refreshMenu: options.refreshMenu ?? (() => {}) }}
          >
            <SuggestionsPanel hubId="h1" reviewId={1} fill={items} onDetails={options.onDetails ?? (() => {})} />
          </ConsoleCtx.Provider>
        </ChatTellCtx.Provider>
      </ChatAskCtx.Provider>
    </I18nProvider>,
  );

beforeEach(() => {
  vi.mocked(applySuggestion).mockReset();
  window.localStorage.clear();
});

describe("a suggestion card on the suggestions panel", () => {
  it("draws the same bar as a finding: Ask, Apply, Details and Dismiss", () => {
    const { container } = show(fill(change));

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Apply", "Details", "Dismiss"]]);
  });

  it("draws Enhance with a wand in place of Apply for a suggestion with no change of its own", () => {
    const { container } = show(fill(advice));

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Enhance", "Details", "Dismiss"]]);
    expect(screen.getByRole("button", { name: "Enhance" }).querySelector("svg")).not.toBeNull();
  });

  it("applies the change, refreshes the menu, tells the chat and drops Apply and Dismiss without a state word", async () => {
    const user = userEvent.setup();
    const refreshMenu = vi.fn();
    const tell = vi.fn();
    vi.mocked(applySuggestion).mockResolvedValue(undefined);
    const { container } = show(fill(change), { refreshMenu, tell });

    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(rowBars(container)).toEqual([["Ask the chat about this", "Details"]]));
    expect(applySuggestion).toHaveBeenCalledWith("h1", "goals", change);
    expect(refreshMenu).toHaveBeenCalledTimes(1);
    expect(tell).toHaveBeenCalledWith("Applied: Rename O-15");
    expect(screen.queryByText("Applied")).not.toBeInTheDocument();
  });

  it("disables Apply and Dismiss while the change is being made", async () => {
    const user = userEvent.setup();
    vi.mocked(applySuggestion).mockReturnValue(new Promise(() => {}));
    show(fill(change));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });

  it("shows the sentence of a failed apply and keeps Apply enabled", async () => {
    const user = userEvent.setup();
    vi.mocked(applySuggestion).mockRejectedValue(new Error("O-15 is not in the draft any more."));
    show(fill(change));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("O-15 is not in the draft any more.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("hands the suggestion over when Details is pressed", async () => {
    const user = userEvent.setup();
    const onDetails = vi.fn();
    show(fill(change), { onDetails });

    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(onDetails).toHaveBeenCalledWith(change);
  });

  it("takes a dismissed suggestion off the panel and leaves the others with their own bar", async () => {
    const user = userEvent.setup();
    const { container } = show(fill(change, advice));

    await user.click(within(screen.getByText("Rename O-15").closest(".suggestion") as HTMLElement).getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Rename O-15")).not.toBeInTheDocument();
    expect(rowBars(container)).toEqual([["Ask the chat about this", "Enhance", "Details", "Dismiss"]]);
  });
});
