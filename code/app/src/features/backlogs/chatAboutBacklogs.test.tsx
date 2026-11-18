import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { AssistantPage } from "../assistant/AssistantPage";
import { type AssistantClient } from "../assistant/api";
import { routes as appRoutes } from "../../app/routes";
import { carriedChatAbout, forgetChatAbout } from "../../app/chatAbout";
import { BacklogsRoutes } from "./BacklogsRoutes";
import { taskTools } from "./shared/api";

vi.mock("../inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const hub = "hub-1";

const tasks = [
  { id: "t1", title: "Fix mirrored board drift", rank: 1, status: "pending", state: "To do", project_name: "hub-steward", tags: ["Docs"], backlog: "backlog", step: "to-do" },
];

const stepNames = ["To do", "Doing", "Done"];

beforeEach(() => {
  openAgency(hub);
  forgetChatAbout();
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    switch (tool) {
      case taskTools.list:
        return { items: tasks };
      case taskTools.backlogs:
        return { items: [{ id: "backlog", name: "Backlog", issues: 1, steps: stepNames.map((name) => ({ id: name.toLowerCase().replace(" ", "-"), name, issues: 0 })) }] };
      case taskTools.get:
        return tasks.find((one) => one.id === args.taskID);
      case "agency_get_agency":
        return { id: hub, name: "Hub Steward SWE" };
      default:
        return { items: [], modules: [] };
    }
  }) as never);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  forgetChatAbout();
  vi.restoreAllMocks();
});

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

const openAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/*" element={<BacklogsRoutes />} />
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the Backlogs list on a wide screen", () => {
  it("shows the bottom bar with Chat, and no status bar in its place", async () => {
    setWide(true);
    openAt("/a/hub-1/backlogs");
    await screen.findByText("3 steps · 1 issue");
    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(bar).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Status bar")).toBeNull();
  });

  it("opens the assistant about the backlogs", async () => {
    setWide(true);
    openAt("/a/hub-1/backlogs");
    await screen.findByText("3 steps · 1 issue");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Backlogs");
    expect(carriedChatAbout()).toMatchObject({ kind: "backlogs", name: "Backlogs" });
  });
});

describe("the Backlogs list on a phone", () => {
  it("opens the assistant about the backlogs", async () => {
    setWide(false);
    openAt("/a/hub-1/backlogs");
    await screen.findByText("3 steps · 1 issue");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Backlogs");
    expect(carriedChatAbout()).toMatchObject({ kind: "backlogs", name: "Backlogs" });
  });
});

describe("the issues of a backlog", () => {
  it("opens the assistant about All issues, by its name", async () => {
    setWide(false);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About All issues");
    expect(carriedChatAbout()).toMatchObject({ kind: "backlogs", name: "All issues" });
  });

  it("opens the assistant about the backlog, by its name and never its id", async () => {
    setWide(false);
    openAt("/a/hub-1/backlogs/backlog");
    await screen.findByText("Fix mirrored board drift");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Backlog");
    expect(carriedChatAbout()).toEqual({ kind: "backlog", id: "backlog", name: "Backlog" });
  });

  it("opens the assistant about the backlog from its board", async () => {
    setWide(false);
    openAt("/a/hub-1/backlogs/backlog/board");
    await screen.findByText("Fix mirrored board drift");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Backlog");
    expect(carriedChatAbout()).toMatchObject({ kind: "backlog", id: "backlog", name: "Backlog" });
  });

  it("opens the assistant about the backlog from its own page", async () => {
    setWide(false);
    openAt("/a/hub-1/backlogs/backlog/page");
    await screen.findByText("Steps, in order");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Backlog");
    expect(carriedChatAbout()).toMatchObject({ kind: "backlog", id: "backlog", name: "Backlog" });
  });
});

describe("an issue", () => {
  it("opens the assistant about the issue, by its title", async () => {
    setWide(false);
    openAt("/a/hub-1/backlogs/issue/t1");
    await screen.findAllByText("Fix mirrored board drift");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Fix mirrored board drift");
    expect(carriedChatAbout()).toEqual({ kind: "backlog-issue", id: "t1", name: "Fix mirrored board drift" });
  });
});
