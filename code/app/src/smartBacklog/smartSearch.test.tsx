import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { BacklogsClient, Issue, IssueDetail } from "../backlogs/api";
import { SmartBacklogPage } from "./SmartBacklogPage";
import type { SmartBacklogClient } from "./types";

vi.mock("../wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../wakala/mcp")>("../wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(() => openAgency("hub-1"));

afterEach(() => forgetOpenAgency());

const made = (n: number, title: string, step: string, mark: "Ready" | "Blocked"): Issue => ({
  id: `t${n}`,
  code: `SW${n}`,
  title,
  description: "d",
  status: "pending",
  step,
  repo: "repo-a",
  topics: [],
  backlog: "Backlog",
  backlogId: "backlog",
  mark,
  rank: n,
});

const all = [made(203, "Hook the voice", "To do", "Ready"), made(204, "Rename the cards", "Doing", "Ready"), made(205, "Voice of the board", "To do", "Blocked")];

const issues: BacklogsClient = {
  backlogs: async () => [],
  issues: async () => all,
  issue: async () => ({ ...all[0], waitsOn: [], waitedOnBy: [] }) as IssueDetail,
};

const smart: SmartBacklogClient = {
  choices: async () => ({ tag: [], mark: [], backlog: [], step: [], priority: [] }),
  count: async () => 3,
  create: async () => "x",
  read: async (id) => ({ id, name: "Ready to start", set: { match: "all", rules: [] }, issues: 3 }),
  update: async () => undefined,
  mayManage: async () => false,
  remove: async () => undefined,
};

const open = () =>
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/ready/smart"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/:backlogId/smart" element={<SmartBacklogPage client={smart} issues={issues} manage={{ mayManage: async () => false } as never} />} />
      </Routes>
    </MemoryRouter>,
  );

const search = async (text: string) => userEvent.type(await screen.findByRole("searchbox", { name: "Search issues" }), text);

describe("searching a smart backlog", () => {
  it("shows the search box and the plain count while nothing is typed", async () => {
    open();
    expect(await screen.findByRole("searchbox", { name: "Search issues" })).toHaveValue("");
    expect(screen.getByText("3 issues")).toBeInTheDocument();
  });

  it("narrows the list by code and says how many of the whole it shows", async () => {
    open();
    await search("sw204");
    expect(screen.getByText("Rename the cards")).toBeInTheDocument();
    expect(screen.queryByText("Hook the voice")).toBeNull();
    expect(screen.queryByText("Voice of the board")).toBeNull();
    expect(screen.getByText("1 of 3 issues")).toBeInTheDocument();
  });

  it("narrows by a title word in either case, in the list and on the board", async () => {
    open();
    await search("VOICE");
    expect(screen.getByText("Hook the voice")).toBeInTheDocument();
    expect(screen.getByText("Voice of the board")).toBeInTheDocument();
    expect(screen.queryByText("Rename the cards")).toBeNull();
    expect(screen.getByText("2 of 3 issues")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(screen.getByText("Hook the voice")).toBeInTheDocument();
    expect(screen.queryByText("Rename the cards")).toBeNull();
    expect(screen.getByText("2 of 3 issues")).toBeInTheDocument();
  });

  it("matches the tags too", async () => {
    open();
    await search("blocked");
    expect(screen.getByText("Voice of the board")).toBeInTheDocument();
    expect(screen.queryByText("Hook the voice")).toBeNull();
  });

  it("clears with the clear button and shows everything again", async () => {
    open();
    await search("sw204");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox", { name: "Search issues" })).toHaveValue("");
    expect(screen.getAllByText(/the (voice|cards|board)/i)).toHaveLength(3);
    expect(screen.getByText("3 issues")).toBeInTheDocument();
  });

  it("says nothing matches when the search finds none", async () => {
    open();
    await search("zzz");
    expect(screen.getByText("No issues match")).toBeInTheDocument();
    expect(screen.getByText("0 of 3 issues")).toBeInTheDocument();
  });
});
