import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { Issue } from "../backlogs/api";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import type { AssistantClient } from "./api";
import { requeueUnanswered, type Item } from "./queue";
import { resultsOf, withIds, worthKeeping, type ResultDraft } from "./results";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn(), listTools: vi.fn(), McpError: class extends Error {} }));

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

const draft = (title: string, codes: number[], total = codes.length): ResultDraft => ({ title, total, issues: codes.map(issue) });

describe("the lists one answer collects", () => {
  it("keeps one entry for the same issues read twice under different titles, the later read", () => {
    const kept = worthKeeping([draft("Pending Blocked issues", [1, 2], 9), draft("Blocked issues", [1, 2]), draft("Other", [3])]);
    expect(kept.map((one) => one.title)).toEqual(["Blocked issues", "Other"]);
  });

  it("drops the list a later read narrows, and keeps lists that only share some issues", () => {
    const kept = worthKeeping([draft("Issues", [1, 2, 3]), draft("Blocked issues", [1, 2]), draft("Ready issues", [3, 4])]);
    expect(kept.map((one) => one.title)).toEqual(["Blocked issues", "Ready issues"]);
  });

  it("shows the narrowed list of the newest answer, not the wider one it came from", () => {
    const results = resultsOf([{ lists: withIds([draft("Issues", [1, 2, 3])], 0) }, { lists: withIds([draft("Issues", [1, 2, 3]), draft("Blocked issues", [1, 2])], 1) }]);
    expect(results.map((one) => one.title)).toEqual(["Blocked issues", "Issues"]);
  });
});

describe("the conversation kept while an issue is open", () => {
  it("asks again for a question that was sent and never answered", () => {
    const items: Item[] = [
      { id: 1, role: "user", content: "first" },
      { id: 2, role: "assistant", content: "answer" },
      { id: 3, role: "user", content: "second" },
    ];
    expect(requeueUnanswered(items).map((one) => one.queued ?? false)).toEqual([false, false, true]);
    expect(requeueUnanswered(items.slice(0, 2))).toEqual(items.slice(0, 2));
  });

  it("is still there, with its Results lists, after the back arrow of an opened issue", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "Three are blocked.", lists: [draft("Blocked issues", [1, 2, 3])] });
    const client: AssistantClient = { model: async () => "acc1", ask };
    function Issue() {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>back from the issue</button>;
    }
    render(
      <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
        <Routes>
          <Route path={routes.assistant.pattern} element={<AssistantPage client={client} />} />
          <Route path="*" element={<Issue />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByRole("textbox", { name: "Ask about the backlogs" }), "which are blocked");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Three are blocked.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Results/ }));
    await userEvent.click(document.querySelector(".issue-row .open")!);
    await userEvent.click(await screen.findByRole("button", { name: "back from the issue" }));
    expect(await screen.findByText("Blocked issues · 3", { selector: ".card-title" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Chat/ }));
    expect(screen.getByText("which are blocked")).toBeTruthy();
    expect(screen.getByText("Three are blocked.")).toBeTruthy();
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
