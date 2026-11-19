import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { answerPoll, listOpenPolls, readCount } from "./api";
import { QuestionScreen } from "./QuestionScreen";

const base = "https://wakala.test/instances/farmers/voting/polls";

const poll = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  question: "Which day for the market",
  mode: "single",
  group_ids: ["g1"],
  opens_at: "2026-11-01T00:00:00Z",
  closes_at: "2026-12-01T00:00:00Z",
  state: "open",
  choices: [
    { id: "c1", label: "Monday", position: 1 },
    { id: "c2", label: "Tuesday", position: 2 },
  ],
  answered: false,
  ...over,
});

const count = {
  poll_id: "p1",
  choices: [
    { choice_id: "c1", label: "Monday", position: 1, votes: 2 },
    { choice_id: "c2", label: "Tuesday", position: 2, votes: 3 },
  ],
  answered: 5,
};

type Replies = { open?: unknown[]; answer?: Response; count?: Response };

const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

const hub = (replies: Replies = {}) => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET" && url === `${base}/open`) return reply(200, replies.open ?? [poll()]);
    if (method === "POST" && url === `${base}/p1/answers`) return replies.answer ?? reply(201, {});
    if (method === "GET" && url === `${base}/p1/count`) return replies.count ?? reply(403, { error: "not allowed" });
    return reply(404, { error: "no such route" });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

const sentCalls = (fetcher: ReturnType<typeof hub>) => fetcher.mock.calls.map(([url, init]) => [init?.method ?? "GET", url]);

const show = () =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/question"]}>
      <QuestionScreen />
    </MemoryRouter>,
  );

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  vi.unstubAllGlobals();
  forgetOpenAgency();
});

describe("the question screen", () => {
  it("lists the open question with its choices as one choice to pick", async () => {
    const fetcher = hub();
    show();
    expect(await screen.findByText("Which day for the market")).toBeInTheDocument();
    const monday = screen.getByRole("radio", { name: "Monday" });
    const tuesday = screen.getByRole("radio", { name: "Tuesday" });
    expect(monday).not.toBeChecked();
    await userEvent.click(tuesday);
    expect(tuesday).toBeChecked();
    await userEvent.click(monday);
    expect(monday).toBeChecked();
    expect(tuesday).not.toBeChecked();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(sentCalls(fetcher)).toContainEqual(["GET", `${base}/open`]);
  });

  it("posts the picked choice as one vote when Send is pressed, and says the answer was sent", async () => {
    const fetcher = hub();
    show();
    await userEvent.click(await screen.findByRole("radio", { name: "Tuesday" }));
    expect(sentCalls(fetcher)).not.toContainEqual(["POST", `${base}/p1/answers`]);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Your answer was sent.")).toBeInTheDocument();
    const posts = fetcher.mock.calls.filter(([url, init]) => init?.method === "POST" && String(url).startsWith(base));
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe(`${base}/p1/answers`);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ votes: { c2: 1 } });
    expect(new Headers(posts[0][1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("shows a question she already answered as answered, with no Send button", async () => {
    hub({ open: [poll({ answered: true })] });
    show();
    expect(await screen.findByText("Which day for the market")).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("says in words that the answer was refused when the hub answers 409", async () => {
    hub({ answer: reply(409, { error: "You already answered this question." }) });
    show();
    await userEvent.click(await screen.findByRole("radio", { name: "Monday" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("You already answered this question.")).toBeInTheDocument();
    expect(screen.queryByText("Your answer was sent.")).not.toBeInTheDocument();
  });

  it("shows only the empty state, a card with no question and no Send button, when nothing is open", async () => {
    hub({ open: [] });
    show();
    const words = await screen.findByText("No question is open");
    expect(words.closest(".card")).toHaveClass("empty");
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("the count on the question screen", () => {
  it("shows each choice with its votes and how many answered when the count route answers 200", async () => {
    const fetcher = hub({ count: reply(200, count) });
    show();
    expect(await screen.findByText("Monday: 2")).toBeInTheDocument();
    expect(screen.getByText("Tuesday: 3")).toBeInTheDocument();
    expect(screen.getByText("5 answered")).toBeInTheDocument();
    expect(sentCalls(fetcher)).toContainEqual(["GET", `${base}/p1/count`]);
  });

  it("shows no count when the count route answers 403", async () => {
    const fetcher = hub({ count: reply(403, { error: "not allowed" }) });
    show();
    await screen.findByText("Which day for the market");
    await waitFor(() => expect(sentCalls(fetcher)).toContainEqual(["GET", `${base}/p1/count`]));
    expect(screen.queryByText("Monday: 2")).not.toBeInTheDocument();
    expect(screen.queryByText(/answered$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the polls api", () => {
  it("lists the open questions of the open agency", async () => {
    const fetcher = hub({ open: [poll()] });
    const found = await listOpenPolls();
    expect(found.map((p) => [p.id, p.question, p.answered, p.choices.map((c) => c.label)])).toEqual([["p1", "Which day for the market", false, ["Monday", "Tuesday"]]]);
    expect(sentCalls(fetcher)).toEqual([["GET", `${base}/open`]]);
  });

  it("answers with the choice as one vote and reports a repeat answer with the hub's words", async () => {
    const fetcher = hub({ answer: reply(409, { error: "You already answered this question." }) });
    await expect(answerPoll("p1", "c1")).rejects.toThrow("You already answered this question.");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ votes: { c1: 1 } });
  });

  it("reads the count for the owner and nothing for a resident", async () => {
    hub({ count: reply(200, count) });
    expect(await readCount("p1")).toMatchObject({ answered: 5, choices: [{ label: "Monday", votes: 2 }, { label: "Tuesday", votes: 3 }] });
    hub({ count: reply(403, { error: "not allowed" }) });
    expect(await readCount("p1")).toBeNull();
  });
});
