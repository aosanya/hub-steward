import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import type { DraftChange, DraftProblem, DraftState, Published } from "../data/draft";
import { I18nProvider } from "../i18n";
import { DraftBar } from "./DraftBar";

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const change = (id: string, over: Partial<DraftChange> = {}): DraftChange => ({
  id,
  summary: "Add the goal " + id,
  title: id,
  kindWord: "draft.kindGoal",
  page: "goals",
  decidedBy: "Amos",
  at: "2026-10-20T10:00:00Z",
  ...over,
});

const three = [change("a1"), change("a2"), change("a3")];
const published: Published = { version: 4, tag: "v4", at: "2026-10-20T14:32:00Z" };

type Over = { state?: DraftState; changes?: DraftChange[]; problems?: DraftProblem[]; version?: Published | null };

function draw(over: Over = {}, lang = "en") {
  localStorage.setItem("lang", lang);
  const onPublish = vi.fn();
  render(
    <I18nProvider initial={words}>
      <MemoryRouter>
        <DraftBar
          hubId="h1"
          state={over.state ?? "pending"}
          changes={over.changes ?? three}
          problems={over.problems ?? []}
          version={over.version ?? null}
          onPublish={onPublish}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
  return { onPublish };
}

const bar = () => screen.getByRole("region", { name: "Changes not published" });

afterEach(() => localStorage.clear());

describe("the draft bar with changes waiting", () => {
  it("draws nothing while nothing is waiting", () => {
    draw({ state: "none", changes: [] });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is the design's bar: an amber dot, the count in bold, a link to see what changed and a primary Publish button", () => {
    draw();
    expect(bar()).toHaveClass("draft");
    expect(bar().querySelector(".draft-text .dot")).not.toBeNull();
    expect(within(bar()).getByText("3 changes not published").tagName).toBe("STRONG");
    expect(within(bar()).getByRole("button", { name: "Publish" })).toHaveClass("btn", "primary", "sm", "publish");
  });

  it("says one change in the singular", () => {
    draw({ changes: [change("a1")] });
    expect(within(bar()).getByText("1 change not published")).toBeInTheDocument();
  });

  it("links See what changed to the answer on the Goals page", () => {
    draw();
    expect(within(bar()).getByRole("link", { name: "See what changed" })).toHaveAttribute("href", "/h/h1/goals?changes=1");
  });

  it("asks to publish when Publish is pressed", async () => {
    const user = userEvent.setup();
    const { onPublish } = draw();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("shows no problem card while nothing has failed", () => {
    draw();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the draft bar while publishing", () => {
  it("says the agency is being checked and keeps the number of changes beside it", () => {
    draw({ state: "publishing" });
    expect(within(bar()).getByText("Checking the agency before publishing").tagName).toBe("STRONG");
    expect(within(bar()).getByText("3 changes")).toHaveClass("soft");
    expect(screen.queryByText("3 changes not published")).not.toBeInTheDocument();
  });

  it("says one change in the singular while publishing", () => {
    draw({ state: "publishing", changes: [change("a1")] });
    expect(within(bar()).getByText("1 change")).toBeInTheDocument();
  });

  it("turns the button into a busy primary button with a spinner that reads Publishing", () => {
    draw({ state: "publishing" });
    const button = within(bar()).getByRole("button", { name: "Publishing" });
    expect(button).toHaveClass("primary", "sm", "publish");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".tool-spin")).not.toBeNull();
  });

  it("does nothing when the busy button is pressed again", async () => {
    const user = userEvent.setup();
    const { onPublish } = draw({ state: "publishing" });
    await user.click(screen.getByRole("button", { name: "Publishing" }));
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("offers no list of changes and no second Publish while publishing", () => {
    draw({ state: "publishing" });
    expect(screen.queryByRole("link", { name: "See what changed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("speaks German while publishing", () => {
    draw({ state: "publishing" }, "de");
    expect(screen.getByText("Die Agency wird vor dem Veröffentlichen geprüft")).toBeInTheDocument();
    expect(screen.getByText("3 Änderungen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wird veröffentlicht" })).toBeInTheDocument();
  });
});

describe("the draft bar after a refused publish", () => {
  const problems: DraftProblem[] = [
    { message: 'Goal G-3 "Grow maize" has no Objectives', to: "/h/h1/goals?goal=g3", open: "draft.openGoal" },
    { message: 'Role R-2 "Treasurer" declares unknown permission "pay"', to: "/h/h1/roles?open=r2", open: "draft.openRole" },
    { message: "Value V-1 is attached to objective O-1, which does not exist" },
  ];

  it("keeps the bar with its count and reads Publish again", async () => {
    const user = userEvent.setup();
    const { onPublish } = draw({ state: "failed", problems });
    expect(within(bar()).getByText("3 changes not published")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish again" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("draws an error card under the bar that counts the problems", () => {
    draw({ state: "failed", problems });
    const card = screen.getByRole("alert");
    expect(card.querySelector(":scope > .card")).toHaveClass("msg-card", "bad", "wide");
    expect(within(card).getByText("Nothing was published: the check found 3 problems")).toBeInTheDocument();
    expect(bar().compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says one problem in the singular", () => {
    draw({ state: "failed", problems: problems.slice(0, 1) });
    expect(within(screen.getByRole("alert")).getByText("Nothing was published: the check found 1 problem")).toBeInTheDocument();
  });

  it("lists each problem as a plain sentence", () => {
    draw({ state: "failed", problems });
    const card = screen.getByRole("alert");
    expect(card.querySelectorAll(".list-row")).toHaveLength(3);
    expect(within(card).getByText('Goal G-3 "Grow maize" has no Objectives')).toBeInTheDocument();
    expect(within(card).getByText("Value V-1 is attached to objective O-1, which does not exist")).toBeInTheDocument();
  });

  it("links each problem to the page and item where it is fixed, with a label saying what opens", () => {
    draw({ state: "failed", problems });
    const card = screen.getByRole("alert");
    expect(within(card).getByRole("link", { name: "Open the goal" })).toHaveAttribute("href", "/h/h1/goals?goal=g3");
    expect(within(card).getByRole("link", { name: "Open the role" })).toHaveAttribute("href", "/h/h1/roles?open=r2");
  });

  it("gives a problem that has no page of its own a sentence and no link", () => {
    draw({ state: "failed", problems });
    expect(within(screen.getByRole("alert")).getAllByRole("link")).toHaveLength(2);
  });

  it("says in words that nothing changed when the backend found nothing new to publish", () => {
    draw({ state: "failed", problems: [{ message: "", word: "draft.noChanges" }] });
    expect(within(screen.getByRole("alert")).getByText("Nothing has changed since the last published version.")).toBeInTheDocument();
  });

  it("says in words that the publish failed when no sentence is known", () => {
    draw({ state: "failed", problems: [{ message: "", word: "draft.publishFailed" }] });
    expect(within(screen.getByRole("alert")).getByText("The agency could not be published. Try again.")).toBeInTheDocument();
  });

  it("says Not published and offers no list of changes when the failure comes with no change left to count", () => {
    draw({ state: "failed", changes: [], problems });
    expect(within(bar()).getByText("Not published")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See what changed" })).not.toBeInTheDocument();
  });

  it("draws just the bar when it is told it failed but names no problem", () => {
    draw({ state: "failed", problems: [] });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Publish again" })).toBeInTheDocument();
  });
});

describe("the draft bar after publishing", () => {
  it("shows a quiet chip saying which version was published, with the time", () => {
    draw({ state: "published", changes: [], version: published });
    const chip = screen.getByText("Published as version 4").closest(".tag");
    expect(chip).toHaveClass("mute");
    const row = screen.getByRole("status");
    expect(row).toHaveClass("row");
    expect(row).toContainElement(chip as HTMLElement);
    expect(row.querySelector(".muted")?.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("has no bar, no Publish button and no link", () => {
    draw({ state: "published", changes: [], version: published });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("draws nothing when it is told it published but not which version", () => {
    draw({ state: "published", changes: [], version: null });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("the words of the draft bar", () => {
  it("speaks German when the manager chose German", () => {
    draw({}, "de");
    expect(screen.getByText("3 Änderungen nicht veröffentlicht")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Veröffentlichen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Änderungen ansehen" })).toBeInTheDocument();
  });

  it("speaks French in the published chip", () => {
    draw({ state: "published", changes: [], version: published }, "fr");
    expect(screen.getByText("Publiée en version 4")).toBeInTheDocument();
  });

  it("speaks Swahili in the error card", () => {
    draw({ state: "failed", problems: [{ message: "x", to: "/h/h1/goals", open: "draft.openGoal" }] }, "sw");
    expect(within(screen.getByRole("alert")).getByText("Hakuna kilichochapishwa: ukaguzi umepata tatizo 1")).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).getByRole("link", { name: "Fungua lengo" })).toBeInTheDocument();
  });
});
