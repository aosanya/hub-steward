import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { Issue } from "../backlogs/api";
import type { AssistantClient } from "./api";
import { say, showAssistant } from "./assistantScreen";
import type { ResultDraft } from "./results";
import { forgetConversations } from "./session";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn(), listTools: vi.fn(), McpError: class extends Error {} }));

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  forgetOpenAgency();
  forgetConversations();
});

type Answer = { text: string; lists: ResultDraft[] };

const issue = (code: number, title: string): Issue => ({
  id: `${title}-${code}`,
  title: `${title} ${code}`,
  description: "",
  status: "pending",
  step: "To do",
  repo: "mwanachama-frontend-kazi",
  topics: [],
  backlog: "Backlog",
  mark: "Blocked",
  rank: code,
});

const draft = (title: string, count: number, total = count): ResultDraft => ({ title, total, issues: Array.from({ length: count }, (_, at) => issue(at + 1, title)) });

const later = () => {
  let resolve: (answer: Answer) => void = () => undefined;
  let reject: (failure: Error) => void = () => undefined;
  const promise = new Promise<Answer>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const show = (ask: AssistantClient["ask"]) => showAssistant({ ask });

const turnsOf = (ask: ReturnType<typeof vi.fn>, call: number) => (ask.mock.calls[call][1] as { content: string }[]).map((turn) => turn.content);

const rowsOf = (title: string) => screen.queryAllByText(new RegExp(`^${title} \\d+$`)).length;

const openResults = () => userEvent.click(screen.getByRole("button", { name: /^Results/ }));

describe("Show more in the Results tab", () => {
  it("shows exactly fifty rows and no button when a list holds fifty, and a button for the fifty-first", async () => {
    show(vi.fn().mockResolvedValueOnce({ text: "Fifty.", lists: [draft("Even", 50)] }).mockResolvedValueOnce({ text: "Fifty one.", lists: [draft("Over", 51)] }));
    await say("even");
    await screen.findByText("Fifty.");
    await openResults();
    expect(rowsOf("Even")).toBe(50);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^Chat/ }));
    await say("over");
    await screen.findByText("Fifty one.");
    await openResults();
    expect(rowsOf("Over")).toBe(50);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(rowsOf("Over")).toBe(51);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("keeps each list's own count of revealed rows when the person moves between lists", async () => {
    show(vi.fn().mockResolvedValueOnce({ text: "Both.", lists: [draft("Wide", 120), draft("Narrow", 80)] }));
    await say("both");
    await screen.findByText("Both.");
    await openResults();
    const select = screen.getByRole("combobox", { name: "Results" });
    expect(select).toHaveDisplayValue("Wide · 120");
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(rowsOf("Wide")).toBe(100);
    await userEvent.selectOptions(select, "Narrow · 80");
    expect(rowsOf("Narrow")).toBe(50);
    expect(rowsOf("Wide")).toBe(0);
    await userEvent.selectOptions(select, "Wide · 120");
    expect(rowsOf("Wide")).toBe(100);
  });

  it("keeps saying how many of the total the tool counted after every row it sent is shown", async () => {
    show(vi.fn().mockResolvedValueOnce({ text: "Many.", lists: [draft("Pending", 120, 1296)] }));
    await say("pending");
    await screen.findByText("Many.");
    await openResults();
    expect(screen.getByText("Showing 120 of 1296")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(rowsOf("Pending")).toBe(120);
    expect(screen.getByText("Showing 120 of 1296")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});

describe("removing a queued message", () => {
  it("takes out only that one: the rest are sent in order and the model never sees the removed words", async () => {
    const first = later();
    const second = later();
    const third = later();
    const answers = [first, second, third];
    const ask = vi.fn().mockImplementation(() => (answers.shift() as ReturnType<typeof later>).promise);
    show(ask);
    await say("one");
    await say("two");
    await say("three");
    await say("four");
    expect(screen.getAllByText("Queued")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Remove from the queue: three" }));
    expect(screen.queryByText("three")).toBeNull();
    expect(screen.getAllByText("Queued")).toHaveLength(2);
    await act(async () => first.resolve({ text: "answer one", lists: [] }));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(turnsOf(ask, 1)).toEqual(["one", "answer one", "two"]);
    await act(async () => second.resolve({ text: "answer two", lists: [] }));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(3));
    expect(turnsOf(ask, 2)).toEqual(["one", "answer one", "two", "answer two", "four"]);
    await act(async () => third.resolve({ text: "answer four", lists: [] }));
    await screen.findByText("answer four");
    expect(ask).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("Queued")).toBeNull();
  });

  it("leaves nothing to send when the only queued message is removed, and no mark on the page", async () => {
    const first = later();
    const ask = vi.fn().mockReturnValue(first.promise);
    show(ask);
    await say("one");
    await say("two");
    await userEvent.click(screen.getByRole("button", { name: "Remove from the queue: two" }));
    expect(screen.queryByText("Queued")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove from the queue/ })).toBeNull();
    await act(async () => first.resolve({ text: "answer one", lists: [] }));
    await screen.findByText("answer one");
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
