import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Suggestion } from "../../data/chatAnswer";
import { setFindingStatus, type Finding } from "../../data/reviewApi";
import { I18nProvider } from "../../i18n";
import { ChatAskCtx, ChatTellCtx } from "../../shell/chatTell";
import { ConsoleCtx } from "../../shell/context";
import { DetailsCtx } from "../../shell/detailsContext";
import { rowBars } from "../../ui/rowBar.test-support";
import { english, hubRow } from "../spec/profileTesting";
import { applyFinding } from "./applyFinding";
import { FindingRow } from "./FindingRow";

const words = { en: { ...english.en, "review.dismissed": "Dismissed", "review.undo": "Reopen" } };

vi.mock("../../data/reviewApi", () => ({ setFindingStatus: vi.fn() }));

vi.mock("./applyFinding", () => ({
  applyFinding: vi.fn(),
  questionAboutFinding: (finding: Finding, text: string) => `About ${finding.title}: ${text}`,
}));


vi.mock("./FindingNotes", () => ({
  FindingNotes: ({ finding }: { finding: Finding }) => <p>Notes of {finding.id}</p>,
}));

vi.mock("./FateChip", () => ({
  FateChip: ({ finding }: { finding: Finding }) => <p>Fate of {finding.id}</p>,
}));

const finding: Finding = {
  id: "f1",
  area_id: "a1",
  title: "Rename O-15",
  detail: "It repeats O-22.",
  tool: "agency_update_objective",
  arguments: { objective_id: "o15" },
  then: [],
  status: "open",
  fate: "new",
  fate_reason: "",
  carried_from_id: "",
  comments: [],
};

const advice: Finding = { ...finding, id: "f2", title: "Think about a measure", tool: "" };

const show = (
  row: Finding,
  options: {
    onFinding?: (finding: Finding) => void;
    onDetails?: (item: Suggestion) => void;
    refreshMenu?: () => void;
    ask?: (text: string) => void;
    tell?: (text: string) => void;
  } = {},
) =>
  render(
    <I18nProvider initial={words}>
      <ChatAskCtx.Provider value={options.ask ?? (() => {})}>
        <ChatTellCtx.Provider value={options.tell ?? (() => {})}>
          <DetailsCtx.Provider value={options.onDetails ?? (() => {})}>
          <ConsoleCtx.Provider
            value={{
              hub: hubRow,
              page: "review",
              setBadges: () => {},
              refreshMenu: options.refreshMenu ?? (() => {}),
            }}
          >
            <FindingRow hubId="h1" finding={row} onFinding={options.onFinding ?? (() => {})} />
          </ConsoleCtx.Provider>
          </DetailsCtx.Provider>
        </ChatTellCtx.Provider>
      </ChatAskCtx.Provider>
    </I18nProvider>,
  );

beforeEach(() => {
  vi.mocked(applyFinding).mockReset();
  vi.mocked(setFindingStatus).mockReset();
});

describe("a finding row on the review page", () => {
  it("shows the title with its detail, and the fate chip and the notes under it", () => {
    show(finding);

    expect(screen.getByText("Rename O-15")).toBeInTheDocument();
    expect(screen.getByText("It repeats O-22.")).toBeInTheDocument();
    expect(screen.getByText("Fate of f1")).toBeInTheDocument();
    expect(screen.getByText("Notes of f1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("draws the same bar as a suggestion, with the note button before Details", () => {
    const { container } = show(finding);

    expect(rowBars(container)).toEqual([["Ask the chat about this", "Apply", "Add a note", "Details", "Dismiss"]]);
  });

  it("applies the change, hands the updated finding up, refreshes the menu and tells the chat", async () => {
    const user = userEvent.setup();
    const onFinding = vi.fn();
    const refreshMenu = vi.fn();
    const tell = vi.fn();
    const applied = { ...finding, status: "applied" as const };
    vi.mocked(applyFinding).mockResolvedValue(applied);
    show(finding, { onFinding, refreshMenu, tell });

    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onFinding).toHaveBeenCalledWith(applied));
    expect(applyFinding).toHaveBeenCalledWith("h1", finding);
    expect(refreshMenu).toHaveBeenCalledTimes(1);
    expect(tell).toHaveBeenCalledWith("Applied: Rename O-15");
  });

  it("disables Apply while the change is being made", async () => {
    const user = userEvent.setup();
    vi.mocked(applyFinding).mockReturnValue(new Promise(() => {}));
    show(finding);

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });

  it("shows the sentence of a failed apply and keeps the row open", async () => {
    const user = userEvent.setup();
    const onFinding = vi.fn();
    const refreshMenu = vi.fn();
    vi.mocked(applyFinding).mockRejectedValue(new Error("O-15 is not in the draft any more."));
    show(finding, { onFinding, refreshMenu });

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("O-15 is not in the draft any more.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(screen.getByText("Rename O-15")).toBeInTheDocument();
    expect(onFinding).not.toHaveBeenCalled();
    expect(refreshMenu).not.toHaveBeenCalled();
  });

  it("offers Enhance, with a wand, instead of Apply when the finding has no change of its own", () => {
    show(advice);

    expect(screen.queryByText("Advice")).not.toBeInTheDocument();
    const enhance = screen.getByRole("button", { name: "Enhance" });
    expect(enhance.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("asks the chat to resolve an advice finding, giving it the whole finding as background", async () => {
    const user = userEvent.setup();
    const ask = vi.fn();
    show(advice, { ask });

    await user.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(ask.mock.calls[0][0]).toContain(advice.title);
    expect(ask.mock.calls[0][0]).toContain(advice.detail);
    expect(ask.mock.calls[0][1]).toContain(`Title: ${advice.title}`);
    expect(ask.mock.calls[0][1]).toContain("Proposed change: none yet");
  });

  it("shows an applied row with no Apply button and no Applied word", () => {
    show({ ...finding, status: "applied" });

    expect(screen.queryByText("Applied")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("dismisses the finding and hands the updated finding up", async () => {
    const user = userEvent.setup();
    const onFinding = vi.fn();
    const dismissed = { ...finding, status: "dismissed" as const };
    vi.mocked(setFindingStatus).mockResolvedValue(dismissed);
    show(finding, { onFinding });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(onFinding).toHaveBeenCalledWith(dismissed));
    expect(setFindingStatus).toHaveBeenCalledWith("h1", "f1", "dismissed");
  });

  it("shows the sentence when dismissing fails", async () => {
    const user = userEvent.setup();
    const onFinding = vi.fn();
    vi.mocked(setFindingStatus).mockRejectedValue(new Error("the finding could not be changed"));
    show(finding, { onFinding });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(await screen.findByText("the finding could not be changed")).toBeInTheDocument();
    expect(onFinding).not.toHaveBeenCalled();
  });

  it("keeps a dismissed row visible with Details and Reopen only, and reopens it", async () => {
    const user = userEvent.setup();
    const onFinding = vi.fn();
    const reopened = { ...finding, status: "open" as const };
    vi.mocked(setFindingStatus).mockResolvedValue(reopened);
    show({ ...finding, status: "dismissed" }, { onFinding });

    expect(screen.getByText("Rename O-15")).toBeInTheDocument();
    expect(screen.queryByText("Dismissed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reopen" }));

    await waitFor(() => expect(onFinding).toHaveBeenCalledWith(reopened));
    expect(setFindingStatus).toHaveBeenCalledWith("h1", "f1", "open");
  });

  it("shows the sentence when reopening fails", async () => {
    const user = userEvent.setup();
    vi.mocked(setFindingStatus).mockRejectedValue(new Error("the finding could not be changed"));
    show({ ...finding, status: "dismissed" });

    await user.click(screen.getByRole("button", { name: "Reopen" }));

    expect(await screen.findByText("the finding could not be changed")).toBeInTheDocument();
  });

  it("hands the finding over when Details is pressed", async () => {
    const user = userEvent.setup();
    const onDetails = vi.fn();
    show(finding, { onDetails });

    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(onDetails).toHaveBeenCalledWith(
      {
        title: finding.title,
        detail: finding.detail,
        tool: finding.tool,
        arguments: finding.arguments,
        then: finding.then,
      },
      expect.anything(),
    );
  });

  it("sends the question about the finding to the chat", async () => {
    const user = userEvent.setup();
    const ask = vi.fn();
    show(finding, { ask });

    await user.click(screen.getByText("Ask the chat about this"));
    await user.type(screen.getByPlaceholderText("Ask the chat about this"), "Why O-22?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(ask).toHaveBeenCalledWith(
      "About Rename O-15: Why O-22?",
      expect.stringContaining(`Title: ${finding.title}`),
    );
    const background = ask.mock.calls[0][1] as string;
    expect(background).toContain(`Detail: ${finding.detail}`);
    expect(background).toContain("Proposed change:");
  });

  it("does not touch local storage", async () => {
    const user = userEvent.setup();
    vi.mocked(applyFinding).mockResolvedValue({ ...finding, status: "applied" });
    const write = vi.spyOn(Storage.prototype, "setItem");
    show(finding);

    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(applyFinding).toHaveBeenCalled());

    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
});
