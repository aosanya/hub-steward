import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFindingStatus, type Finding } from "../../data/reviewApi";
import { I18nProvider } from "../../i18n";
import { ChatAskCtx, ChatTellCtx, type Ask } from "../../shell/chatTell";
import { ConsoleCtx } from "../../shell/context";
import { DetailsCtx } from "../../shell/detailsContext";
import { english, hubRow } from "../spec/profileTesting";
import { FindingRow } from "./FindingRow";

vi.mock("../../data/reviewApi", () => ({ setFindingStatus: vi.fn() }));

vi.mock("./applyFinding", () => ({
  applyFinding: vi.fn(),
  questionAboutFinding: (finding: Finding, text: string) => `About ${finding.title}: ${text}`,
}));

vi.mock("./FindingNotes", () => ({ FindingNotes: () => null }));

vi.mock("./FateChip", () => ({ FateChip: () => null }));

const advice: Finding = {
  id: "f2",
  area_id: "a1",
  title: "G-14 has no objectives",
  detail: "Nothing to track for that goal.",
  tool: "",
  arguments: {},
  then: [],
  status: "open",
  fate: "new",
  fate_reason: "",
  carried_from_id: "",
  comments: [],
};

const show = (ask: Ask, onFinding: (finding: Finding) => void) =>
  render(
    <I18nProvider initial={{ en: english.en }}>
      <ChatAskCtx.Provider value={ask}>
        <ChatTellCtx.Provider value={() => {}}>
          <DetailsCtx.Provider value={() => {}}>
            <ConsoleCtx.Provider value={{ hub: hubRow, page: "review-goals", setBadges: () => {}, refreshMenu: () => {} }}>
              <FindingRow hubId="h1" finding={advice} onFinding={onFinding} />
            </ConsoleCtx.Provider>
          </DetailsCtx.Provider>
        </ChatTellCtx.Provider>
      </ChatAskCtx.Provider>
    </I18nProvider>,
  );

describe("resolving an advice finding through the chat", () => {
  beforeEach(() => vi.mocked(setFindingStatus).mockReset());

  it("marks the finding applied once the chat has changed the draft", async () => {
    const resolved: Finding = { ...advice, status: "applied" };
    vi.mocked(setFindingStatus).mockResolvedValue(resolved);
    const onFinding = vi.fn();
    let afterChange: (() => void) | undefined;
    show((_text, _background, after) => (afterChange = after), onFinding);

    await userEvent.click(screen.getByRole("button", { name: "Enhance" }));
    await waitFor(() => expect(afterChange).toBeDefined());
    expect(setFindingStatus).not.toHaveBeenCalled();

    afterChange?.();
    await waitFor(() => expect(onFinding).toHaveBeenCalledWith(resolved));
    expect(setFindingStatus).toHaveBeenCalledWith("h1", "f2", "applied");
  });

  it("shows the spinner on Enhance from the press until the chat has finished with it", async () => {
    let settled: (() => void) | undefined;
    show((_text, _background, _after, done) => (settled = done), vi.fn());
    const button = screen.getByRole("button", { name: "Enhance" });
    expect(button.querySelector(".tool-spin")).toBeNull();

    await userEvent.click(button);
    await waitFor(() => expect(settled).toBeDefined());
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button.querySelector(".tool-spin")).not.toBeNull();

    act(() => settled?.());
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(button).toBeEnabled();
    expect(button.querySelector(".tool-spin")).toBeNull();
  });
});
