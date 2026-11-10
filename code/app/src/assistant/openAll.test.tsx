import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { Issue } from "../backlogs/api";
import { issuesPath } from "../backlogs/paths";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import type { AssistantClient } from "./api";
import type { ResultDraft } from "./results";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn().mockResolvedValue({ items: [] }), listTools: vi.fn(), McpError: class extends Error {} }));

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const issue = (code: number): Issue => ({
  id: `i${code}`,
  title: `DEV-${String(code).padStart(3, "0")} Create table ${code}`,
  description: "",
  status: "pending",
  step: "To do",
  repo: "mwanachama-frontend-kazi",
  topics: [],
  backlog: "Backlog",
  mark: "Blocked",
  rank: code,
});

const draft = (total: number, count: number, filter?: ResultDraft["filter"]): ResultDraft => ({
  title: "Mwanachama-frontend-kazi issues",
  total,
  issues: Array.from({ length: count }, (_, at) => issue(at + 1)),
  ...(filter ? { filter } : {}),
});

function Where() {
  const here = useLocation();
  return <p>{`at ${here.pathname}${here.search}`}</p>;
}

const open = async (list: ResultDraft) => {
  const client: AssistantClient = { model: async () => "acc1", ask: vi.fn().mockResolvedValue({ text: "Here.", lists: [list] }) };
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={client} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.type(await screen.findByRole("textbox", { name: "Ask about the backlogs" }), "show them");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Here.");
  await userEvent.click(screen.getByRole("button", { name: /^Results/ }));
  await screen.findAllByText(/Create table/);
};

describe("reaching the rest of a long list", () => {
  it("ends a 724-issue list of 24 rows with Open all 724 issues, which opens the List with the tag applied", async () => {
    await open(draft(724, 24, { tags: ["mwanachama-frontend-kazi"], query: "", backlog: "", other: false }));
    expect(screen.getByText("Showing 24 of 724")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open all 724 issues" }));
    expect(await screen.findByText(`at ${issuesPath("all", ["mwanachama-frontend-kazi"])}`)).toBeInTheDocument();
  });

  it("carries the typed search words as the List's search", async () => {
    await open(draft(90, 24, { tags: [], query: "import", backlog: "", other: false }));
    await userEvent.click(screen.getByRole("button", { name: "Open all 90 issues" }));
    expect(await screen.findByText(`at ${issuesPath("all", [], "import")}`)).toBeInTheDocument();
  });

  it("opens All issues and says it is every issue when the list was narrowed by something the List cannot show", async () => {
    await open(draft(40, 24, { tags: [], query: "", backlog: "", other: true }));
    expect(screen.getByText("Opens every issue, not only these.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open all issues" }));
    expect(await screen.findByText(`at ${issuesPath()}`)).toBeInTheDocument();
  });

  it("ends a tagged list that holds all its issues with Open these in the List, which opens the List with the tag applied", async () => {
    await open(draft(3, 3, { tags: ["mwanachama-frontend-kazi"], query: "", backlog: "", other: false }));
    expect(screen.queryByText(/Showing/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Open all/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open these in the List" }));
    expect(await screen.findByText(`at ${issuesPath("all", ["mwanachama-frontend-kazi"])}`)).toBeInTheDocument();
  });

  it("shows no button for a list with no tag, words or backlog that holds all its issues", async () => {
    await open(draft(3, 3, { tags: [], query: "", backlog: "", other: false }));
    expect(screen.queryByRole("button", { name: /^Open/ })).toBeNull();
  });
});
