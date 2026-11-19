import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { AskQuestionScreen } from "./AskQuestionScreen";
import { QuestionScreen } from "./QuestionScreen";

const base = "https://wakala.test/instances/farmers/voting/polls";

const held = { permissions: ["poll.run"] };

const toolReplies = (permissions: string[]) => ({
  agency_get_my_roles: { permissions },
  actor_list_groups: { items: [{ id: "g1", name: "Residents of Zöldhalom" }, { id: "g2", name: "Market traders" }] },
});

vi.mock("../../shared/wakala/mcp", async (original) => ({
  ...(await original<typeof import("../../shared/wakala/mcp")>()),
  callTool: vi.fn(async (_hub: string, tool: string) => (toolReplies(permissionsHeld) as Record<string, unknown>)[tool] ?? {}),
}));

let permissionsHeld: string[] = held.permissions;

const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

type Replies = { create?: Response; choice?: Response };

const hub = (replies: Replies = {}) => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET" && url === `${base}/open`) return reply(200, []);
    if (method === "POST" && url === base) return replies.create ?? reply(201, { id: "p9" });
    if (method === "POST" && url === `${base}/p9/choices`) return replies.choice ?? reply(201, {});
    return reply(404, { error: "no such route" });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

const posts = (fetcher: ReturnType<typeof hub>) => fetcher.mock.calls.filter(([, init]) => init?.method === "POST");

const bodyOf = (call: [string, RequestInit?]) => JSON.parse(String(call[1]?.body));

const showAsk = () =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/question/new"]}>
      <Routes>
        <Route path="/a/:agencyId/question/new" element={<AskQuestionScreen />} />
        <Route path="/a/:agencyId/question" element={<p>Question screen</p>} />
      </Routes>
    </MemoryRouter>,
  );

const fill = async (question: string, first: string, second: string) => {
  await userEvent.type(await screen.findByLabelText("Question"), question);
  await userEvent.type(screen.getByLabelText("Choice 1"), first);
  await userEvent.type(screen.getByLabelText("Choice 2"), second);
  await userEvent.click(screen.getByLabelText("Goes to"));
  await userEvent.click(await screen.findByRole("option", { name: "Residents of Zöldhalom" }));
};

beforeEach(() => {
  permissionsHeld = held.permissions;
  openAgency("farmers");
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetOpenAgency();
});

describe("asking a question", () => {
  it("shows an Ask a question button on the Question screen only to someone who may run a poll", async () => {
    hub();
    render(
      <MemoryRouter initialEntries={["/a/farmers/question"]}>
        <QuestionScreen />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: "Ask a question" })).toBeInTheDocument();
  });

  it("shows no Ask a question button to someone who may not run a poll", async () => {
    permissionsHeld = [];
    hub();
    render(
      <MemoryRouter initialEntries={["/a/farmers/question"]}>
        <QuestionScreen />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No question is open")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ask a question" })).not.toBeInTheDocument());
  });

  it("keeps Open the question disabled until the question, two choices and a group are given", async () => {
    hub();
    showAsk();
    const open = await screen.findByRole("button", { name: "Open the question" });
    expect(open).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Question"), "Which day for the market?");
    await userEvent.type(screen.getByLabelText("Choice 1"), "Monday");
    expect(open).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Choice 2"), "Tuesday");
    expect(open).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Goes to"));
    await userEvent.click(await screen.findByRole("option", { name: "Residents of Zöldhalom" }));
    expect(open).toBeEnabled();
  });

  it("creates the poll for the chosen group with a window that opens now, then adds the choices in order", async () => {
    const fetcher = hub();
    showAsk();
    await fill("Which day for the market?", "Monday", "Tuesday");
    await userEvent.click(screen.getByRole("button", { name: "Open the question" }));
    expect(await screen.findByText("Your question is open.")).toBeInTheDocument();
    const sent = posts(fetcher);
    expect(sent.map(([url]) => url)).toEqual([base, `${base}/p9/choices`, `${base}/p9/choices`]);
    const poll = bodyOf(sent[0] as [string, RequestInit]);
    expect(poll).toMatchObject({ question: "Which day for the market?", mode: "one", per_group: "once", group_ids: ["g1"] });
    const opens = Date.parse(poll.opens_at);
    const closes = Date.parse(poll.closes_at);
    expect(Math.abs(opens - Date.now())).toBeLessThan(60_000);
    expect(Math.round((closes - opens) / 86_400_000)).toBe(7);
    expect(bodyOf(sent[1] as [string, RequestInit])).toEqual({ label: "Monday" });
    expect(bodyOf(sent[2] as [string, RequestInit])).toEqual({ label: "Tuesday" });
  });

  it("lets a third choice be added and sends it too", async () => {
    const fetcher = hub();
    showAsk();
    await fill("Which day?", "Monday", "Tuesday");
    await userEvent.click(screen.getByRole("button", { name: "Add a choice" }));
    await userEvent.type(screen.getByLabelText("Choice 3"), "Friday");
    await userEvent.click(screen.getByRole("button", { name: "Open the question" }));
    await screen.findByText("Your question is open.");
    expect(posts(fetcher)).toHaveLength(4);
    expect(bodyOf(posts(fetcher)[3] as [string, RequestInit])).toEqual({ label: "Friday" });
  });

  it("says in words why the hub refused and keeps everything typed", async () => {
    hub({ create: reply(400, { error: "A question needs a day to close." }) });
    showAsk();
    await fill("Which day?", "Monday", "Tuesday");
    await userEvent.click(screen.getByRole("button", { name: "Open the question" }));
    expect(await screen.findByText("A question needs a day to close.")).toBeInTheDocument();
    expect(screen.getByLabelText("Question")).toHaveValue("Which day?");
    expect(screen.getByLabelText("Choice 1")).toHaveValue("Monday");
    expect(screen.getByLabelText("Choice 2")).toHaveValue("Tuesday");
    expect(screen.queryByText("Your question is open.")).not.toBeInTheDocument();
  });
});
