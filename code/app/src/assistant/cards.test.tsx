import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { BacklogsClient } from "../backlogs/api";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import type { AssistantClient } from "./api";
import { draftOf, questionOptions, viewsOf } from "./results";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const issue = (id: string, title: string) => ({ id, title, description: "", status: "todo", step: "To do", repo: "hub", topics: [], backlog: "Backlog", mark: "" as const, rank: 1 });

const listed = (...titles: string[]) => ({ title: "Issues", total: titles.length, issues: titles.map((title, index) => issue(`i${index}`, title)) });

const backlogsClient = { backlogs: async () => [{ id: "b1", name: "Backlog", steps: ["To do", "Doing", "Done"], issues: 1676 }] } as unknown as BacklogsClient;

const show = (client: AssistantClient) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={client} backlogs={backlogsClient} />} />
      </Routes>
    </MemoryRouter>,
  );

const ask = async (words: string) => {
  await userEvent.type(await screen.findByRole("textbox"), words);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("what a read tells the page to show", () => {
  it("is the all issues card for a read with no filter and nothing for a filtered read", () => {
    const reply = { items: [{ id: "a", title: "A" }], total: 1 };
    expect(draftOf("taskmanager_task_pending", {}, reply)?.view).toBe("all");
    expect(draftOf("taskmanager_task_list", { tag: "Blocked" }, reply)?.view).toBeUndefined();
    expect(draftOf("taskmanager_task_pending", { q: "import" }, reply)?.view).toBeUndefined();
  });

  it("is the backlogs card for the backlog list, which holds no issues", () => {
    const draft = draftOf("taskmanager_backlog_list", {}, { items: [{ id: "b1", name: "Backlog" }] });
    expect(draft?.view).toBe("backlogs");
    expect(draft?.issues).toEqual([]);
  });

  it("is listed once, in the order read", () => {
    expect(viewsOf([{ ...listed("A"), view: "all" }, { title: "Backlogs", total: 1, issues: [], view: "backlogs" }, { ...listed("B"), view: "all" }])).toEqual(["all", "backlogs"]);
  });
});

describe("the cards under an answer", () => {
  it("opens all issues from a card with the hub's total when the answer read the unfiltered list", async () => {
    const reply = vi.fn().mockResolvedValue({ text: "1,676 issues are pending.", lists: [{ ...listed("A"), view: "all" }] });
    show({ model: async () => "acc1", ask: reply });
    await ask("show all issues");
    expect(await screen.findByText("1,676 issues are pending.")).toBeInTheDocument();
    expect(await screen.findByText("All issues")).toBeInTheDocument();
    expect(await screen.findByText("1676 issues")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/a/farmers/backlogs/all");
  });

  it("opens a backlog's board from a button when the answer read the backlogs", async () => {
    const reply = vi.fn().mockResolvedValue({ text: "One backlog.", lists: [{ title: "Backlogs", total: 1, issues: [], view: "backlogs" }] });
    show({ model: async () => "acc1", ask: reply });
    await ask("show the Backlog board");
    const button = await screen.findByRole("link", { name: /Backlog.*3 steps/ });
    expect(button).toHaveAttribute("href", "/a/farmers/backlogs/b1/board");
  });

  it("shows no card when the answer read a filtered list", async () => {
    const reply = vi.fn().mockResolvedValue({ text: "3 are Blocked.", lists: [listed("A", "B", "C")] });
    show({ model: async () => "acc1", ask: reply });
    await ask("blocked ones");
    expect(await screen.findByText("3 are Blocked.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open" })).toBeNull();
  });
});

describe("a question about which one in words", () => {
  const several = listed("Import the municipality", "Import the story boards", "Import the tags");

  it("takes the issues the search found as its buttons when the answer has none of its own", () => {
    expect(questionOptions("Which one did you want moved to Doing?", [several])).toEqual(["Import the municipality", "Import the story boards", "Import the tags"]);
  });

  it("takes none when the answer is not a question, has its own buttons, or the search found one or too many", () => {
    expect(questionOptions("Moved it.", [several])).toEqual([]);
    expect(questionOptions("Which one?\n[[A]]", [several])).toEqual([]);
    expect(questionOptions("Which one?", [listed("Only one")])).toEqual([]);
    expect(questionOptions("Which one?", [listed(...Array.from({ length: 7 }, (_, index) => `Issue ${index}`))])).toEqual([]);
  });

  it("shows the buttons on the page and sends the chosen title as the next message", async () => {
    const reply = vi
      .fn()
      .mockResolvedValueOnce({ text: "Which one did you want moved to Doing?", lists: [several] })
      .mockResolvedValueOnce({ text: "Done.", lists: [] });
    show({ model: async () => "acc1", ask: reply });
    await ask("Move the import to Doing");
    await userEvent.click(await screen.findByRole("button", { name: "Import the story boards" }));
    expect(await screen.findByText("Done.")).toBeInTheDocument();
    expect(reply.mock.calls[1][1].at(-1).content).toBe("Import the story boards");
  });
});
