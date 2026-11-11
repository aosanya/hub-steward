import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { SmartBacklogPage } from "./SmartBacklogPage";
import type { RuleSet, SmartBacklogClient } from "./types";

vi.mock("../wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../wakala/mcp")>("../wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(() => openAgency("hub-1"));

afterEach(() => forgetOpenAgency());

const fiveRules: RuleSet = {
  match: "all",
  rules: [
    { field: "tag", operator: "has", value: "hub-steward-swe" },
    { field: "mark", operator: "is", value: "Ready" },
    { field: "step", operator: "is", value: "To do" },
    { field: "priority", operator: "is", value: "high" },
    { field: "last_changed", operator: "in_the_last", value: "14 days" },
  ],
};

const open = (set: RuleSet) => {
  const client: SmartBacklogClient = {
    choices: async () => ({ tag: [], mark: [], backlog: [], step: [], priority: [] }),
    count: async () => 0,
    create: async () => "x",
    read: async (id) => ({ id, name: "Ready to start", set, issues: 0 }),
    update: async () => undefined,
    mayManage: async () => false,
    remove: async () => undefined,
  };
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/ready/smart"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/:backlogId/smart" element={<SmartBacklogPage client={client} issues={{ issues: async () => [], backlogs: async () => [] } as never} manage={{ mayManage: async () => false } as never} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("the rules in the header of a smart backlog", () => {
  it("shows one rule and no bubble", async () => {
    open({ match: "all", rules: [fiveRules.rules[0]] });
    expect(await screen.findByText("Tag has hub-steward-swe")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
  });

  it("shows only the first of five rules and a +4 more bubble", async () => {
    open(fiveRules);
    expect(await screen.findByText("Tag has hub-steward-swe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+4 more" })).toBeInTheDocument();
    expect(screen.queryByText("Mark is Ready")).toBeNull();
    expect(screen.queryByText("Priority is high")).toBeNull();
  });

  it("opens the five rules one to a line, with how they combine, when the bubble is tapped", async () => {
    open(fiveRules);
    await userEvent.click(await screen.findByRole("button", { name: "+4 more" }));
    const sheet = screen.getByRole("dialog", { name: "Rules" });
    expect(within(sheet).getByText("Matches all of these rules")).toBeInTheDocument();
    expect(within(sheet).getAllByRole("listitem").map((line) => line.textContent)).toEqual([
      "Tag has hub-steward-swe",
      "Mark is Ready",
      "Step is To do",
      "Priority is high",
      "Last changed is in the last 14 days",
    ]);
  });

  it("says any when the rules combine on any", async () => {
    open({ ...fiveRules, match: "any" });
    await userEvent.click(await screen.findByRole("button", { name: "+4 more" }));
    expect(screen.getByText("Matches any of these rules")).toBeInTheDocument();
  });

  it("closes the list on Escape", async () => {
    open(fiveRules);
    await userEvent.click(await screen.findByRole("button", { name: "+4 more" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Rules" })).toBeNull();
  });

  it("keeps today's look for a smart backlog with no rules: the Smart chip and no bubble", async () => {
    open({ match: "all", rules: [] });
    expect(await screen.findByText("Smart")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
  });
});

const css = readFileSync(resolve(__dirname, "smartBacklog.css"), "utf8");

describe("the header line", () => {
  it("never wraps, cuts the rule text and keeps the bubble whole", () => {
    expect(css).toMatch(/\.smart-head\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(css).toMatch(/\.smart-head \.rule-text\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(css).toMatch(/\.smart-head \.chip\s*\{[^}]*flex:\s*none/);
  });
});
