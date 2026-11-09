import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { Issue } from "../backlogs/api";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import type { AssistantClient } from "./api";
import { draftOf, labelOf, pendingTool, titleOf, type ResultDraft } from "./results";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn(), listTools: vi.fn(), McpError: class extends Error {} }));

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const issue = (code: number, mark: Issue["mark"] = "Blocked"): Issue => ({
  id: `i${code}`,
  title: `DEV-${String(code).padStart(3, "0")} Create table ${code}`,
  description: "",
  status: "pending",
  step: "To do",
  repo: "mwanachama-frontend-kazi",
  topics: [],
  backlog: "Backlog",
  mark,
  rank: code,
});

const draft = (title: string, count: number, total = count): ResultDraft => ({ title, total, issues: Array.from({ length: count }, (_, at) => issue(at + 1)) });

function Where() {
  return <p>{useLocation().pathname}</p>;
}

const show = (answers: { text: string; lists: ResultDraft[] }[]) => {
  const ask = vi.fn();
  answers.forEach((answer) => ask.mockResolvedValueOnce(answer));
  const client: AssistantClient = { model: async () => "acc1", ask };
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={client} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
};

const say = async (words: string) => {
  await userEvent.type(await screen.findByRole("textbox", { name: "Ask about the backlogs" }), words);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

const rows = () => document.querySelectorAll(".issue-row").length;

const tab = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("the lists the tools return", () => {
  it("lands in Results and not in the chat, and the chat gets an entry for it", async () => {
    show([{ text: "Two are pending.", lists: [draft("Pending issues", 2)] }]);
    await say("what is pending");
    expect(await screen.findByText("Two are pending.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pending issues · 2/ })).toBeInTheDocument();
    expect(screen.queryByText(/DEV-001/)).toBeNull();
    await userEvent.click(tab("Results"));
    expect(await screen.findByText(/DEV-001/)).toBeInTheDocument();
    expect(screen.getByText(/DEV-002/)).toBeInTheDocument();
    expect(screen.queryByText("Two are pending.")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Results" })).toHaveDisplayValue("Pending issues · 2");
  });

  it("opens the entry's own list from the chat, so an older entry reopens its own list", async () => {
    show([
      { text: "First answer.", lists: [draft("Blocked issues", 3)] },
      { text: "Second answer.", lists: [draft("Ready issues", 5)] },
    ]);
    await say("blocked");
    await screen.findByText("First answer.");
    await say("ready");
    await screen.findByText("Second answer.");
    await userEvent.click(screen.getByRole("button", { name: /Blocked issues · 3/ }));
    expect(screen.getByRole("combobox", { name: "Results" })).toHaveDisplayValue("Blocked issues · 3");
    await screen.findAllByText(/Create table/);
    expect(rows()).toBe(3);
    await userEvent.click(tab("Chat"));
    await userEvent.click(screen.getByRole("button", { name: /Ready issues · 5/ }));
    expect(screen.getByRole("combobox", { name: "Results" })).toHaveDisplayValue("Ready issues · 5");
    expect(rows()).toBe(5);
  });

  it("gives two lists from one answer two entries and two options, the first of the newest answer chosen", async () => {
    show([
      { text: "Old answer.", lists: [draft("Pending issues", 1)] },
      { text: "Both lists.", lists: [draft("Blocked issues", 2), draft("Ready issues", 4)] },
    ]);
    await say("one");
    await screen.findByText("Old answer.");
    await say("two");
    await screen.findByText("Both lists.");
    expect(screen.getByRole("button", { name: /Blocked issues · 2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ready issues · 4/ })).toBeInTheDocument();
    await userEvent.click(tab("Results"));
    const select = screen.getByRole("combobox", { name: "Results" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Blocked issues · 2", "Ready issues · 4", "Pending issues · 1"]);
    expect(select).toHaveDisplayValue("Blocked issues · 2");
    await userEvent.selectOptions(select, "Pending issues · 1");
    expect(rows()).toBe(1);
  });

  it("shows a dot on the Results tab when data arrives while Chat shows, and clears it when Results opens", async () => {
    show([{ text: "Done.", lists: [draft("Pending issues", 2)] }]);
    expect(within(tab("Results")).queryByRole("img", { name: "New results" })).toBeNull();
    await say("go");
    await screen.findByText("Done.");
    expect(within(tab("Results")).getByRole("img", { name: "New results" })).toBeInTheDocument();
    await userEvent.click(tab("Results"));
    expect(within(tab("Results")).queryByRole("img", { name: "New results" })).toBeNull();
    await userEvent.click(tab("Chat"));
    expect(within(tab("Results")).queryByRole("img", { name: "New results" })).toBeNull();
  });

  it("says Results appear here when nothing has been returned", async () => {
    show([]);
    await userEvent.click(await screen.findByRole("button", { name: /^Results/ }));
    expect(screen.getByText("Results appear here")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows fifty rows and reveals fifty more each time Show more is pressed", async () => {
    show([{ text: "Many.", lists: [draft("Pending issues", 120)] }]);
    await say("all");
    await screen.findByText("Many.");
    await userEvent.click(tab("Results"));
    expect(await screen.findAllByText(/Create table/)).toHaveLength(50);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getAllByText(/Create table/)).toHaveLength(100);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getAllByText(/Create table/)).toHaveLength(120);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("states the total the tool reported when it sent fewer rows than that", async () => {
    show([{ text: "Many.", lists: [draft("Pending issues", 25, 1296)] }]);
    await say("pending");
    await screen.findByText("Many.");
    expect(screen.getByRole("button", { name: /Pending issues · 1296/ })).toBeInTheDocument();
    await userEvent.click(tab("Results"));
    expect(await screen.findByText("Showing 25 of 1296")).toBeInTheDocument();
  });

  it("opens an issue's page when its row is tapped", async () => {
    show([{ text: "One.", lists: [draft("Pending issues", 1)] }]);
    await say("pending");
    await screen.findByText("One.");
    await userEvent.click(tab("Results"));
    await userEvent.click(await screen.findByText(/DEV-001/));
    expect(await screen.findByText(/\/issue\/i1$/)).toBeInTheDocument();
  });
});

describe("turning a tool result into a list", () => {
  it("titles a filtered list list by its words and the pending tool as pending", () => {
    expect(titleOf("taskmanager_task_list", { tag: ["blocked", "mwanachama-web"] })).toBe("Blocked mwanachama-web issues");
    expect(titleOf("taskmanager_task_list", {})).toBe("Issues");
    expect(titleOf(pendingTool, {})).toBe("Pending issues");
    expect(titleOf(pendingTool, { backlog: "docs" })).toBe("Pending docs issues");
  });

  it("reads the list tool's items and the pending tool's total", () => {
    const rows = { items: [{ id: "a", title: "DEV-001 One", tags: ["Blocked"] }, { id: "b", title: "DEV-002 Two", tags: [] }] };
    const listed = draftOf("taskmanager_task_list", {}, rows);
    expect(listed?.issues.map((one) => one.id)).toEqual(["a", "b"]);
    expect(listed?.total).toBe(2);
    const pending = draftOf(pendingTool, {}, { total: 1296, by_step: {}, by_priority: {}, items: rows.items });
    expect(pending?.total).toBe(1296);
    expect(pending?.issues).toHaveLength(2);
    expect(labelOf(pending as ResultDraft)).toBe("Pending issues · 1296");
  });

  it("makes a one-issue list of a read issue and nothing of other tools", () => {
    expect(draftOf("taskmanager_task_read", {}, { id: "a", title: "DEV-009 Create", tags: [] })?.issues).toHaveLength(1);
    expect(draftOf("taskmanager_task_read", {}, {})).toBeNull();
    expect(draftOf("taskmanager_backlog_list", {}, { items: [] })).toBeNull();
  });
});
