import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { BacklogsClient, Issue } from "../backlogs/api";
import { IssuesPage } from "../backlogs/IssuesPage";
import { filterDraft, filterName } from "./fromFilter";
import { rulesKey, sameRules } from "./rulesKey";
import { AddSmartBacklogScreen } from "./SmartScreens";
import type { FieldChoices, RuleSet, SmartBacklog, SmartBacklogClient } from "./types";

const issue = (id: string, title: string, over: Partial<Issue> = {}): Issue => ({ id, title, description: "", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Software", mark: "Ready", rank: 1, ...over });

const client: BacklogsClient = {
  backlogs: async () => [{ id: "b1", name: "Software", steps: ["To do"], issues: 2 }],
  issues: async () => [issue("1", "Import the municipality", { mark: "Blocked" }), issue("2", "Switch on the custody module")],
  issue: async () => ({ ...issue("1", "x"), waitsOn: [], waitedOnBy: [] }),
};

const choices: FieldChoices = { tag: ["hub-steward"], mark: ["Ready", "Blocked"], backlog: ["Software"], step: ["To do"], priority: [] };

const smartClient: SmartBacklogClient = {
  choices: async () => choices,
  count: async () => 2,
  create: async () => "s1",
  read: async () => ({ id: "s1", name: "x", set: { match: "all", rules: [] }, issues: 0 }),
  update: async () => undefined,
  mayManage: async () => true,
  remove: async () => undefined,
};

const manage = (allowed: boolean) => ({ mayManage: async () => allowed }) as never;

const existing = (set: RuleSet): SmartBacklog => ({ id: "s9", name: "Software here", set, issues: 2 });

const at = (path: string, may: boolean, smart: SmartBacklog[]) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/new/smart" element={<AddSmartBacklogScreen client={smartClient} />} />
        <Route path="/a/:agencyId/backlogs/:backlogId/smart" element={<p>the smart backlog</p>} />
        <Route path="/a/:agencyId/backlogs/:backlogId" element={<IssuesPage client={client} manage={manage(may)} smartBacklogs={async () => smart} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));
afterEach(() => forgetOpenAgency());

describe("a filter becomes the rules of a smart backlog", () => {
  it("each chosen tag is a rule: a mark and a backlog by their own field, any other tag by Tag has, and each typed word a Title rule", () => {
    const draft = filterDraft(["Ready", "Software", "hub-steward"], "custody  module", ["Software"]);
    expect(draft.match).toBe("all");
    expect(draft.rules).toEqual([
      { field: "mark", operator: "is", value: "Ready" },
      { field: "backlog", operator: "is", value: "Software" },
      { field: "tag", operator: "has", value: "hub-steward" },
      { field: "title", operator: "contains", value: "custody" },
      { field: "title", operator: "contains", value: "module" },
    ]);
  });

  it("the name is made from the filter", () => {
    expect(filterName(["hub-steward", "Software"], "")).toBe("hub-steward Software");
    expect(filterName(["Docs"], " import ")).toBe('Docs "import"');
  });

  it("two rule sets are the same when they differ only in order, case, spacing or a repeated rule, as the server counts them", () => {
    const a: RuleSet = { match: "all", rules: [{ field: "tag", operator: "has", value: "Docs" }, { field: "mark", operator: "is", value: "ready" }] };
    const b: RuleSet = { match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }, { field: "tag", operator: "has", value: " docs " }, { field: "tag", operator: "has", value: "DOCS" }] };
    expect(sameRules(a, b)).toBe(true);
    expect(sameRules(a, { ...b, match: "any" })).toBe(false);
    expect(rulesKey({ match: "all", rules: [{ field: "last_changed", operator: "in_the_last", value: "1 days" }] })).toBe(rulesKey({ match: "all", rules: [{ field: "last_changed", operator: "in_the_last", value: "1 day" }] }));
  });
});

describe("Save as smart backlog on a filtered list", () => {
  it("opens the rules screen filled from the chosen tags and the search", async () => {
    at("/a/hub-1/backlogs/all?tag=hub-steward&tag=Software&q=custody", true, []);
    await userEvent.click(await screen.findByRole("button", { name: "Save as smart backlog" }));
    expect(await screen.findByDisplayValue('hub-steward Software "custody"')).toBeInTheDocument();
    expect(screen.getByLabelText("Value of rule 1")).toHaveValue("hub-steward");
    expect(screen.getByLabelText("Value of rule 3")).toHaveValue("custody");
  });

  it("is not offered without a filter", async () => {
    at("/a/hub-1/backlogs/all", true, []);
    await screen.findByText("Import the municipality");
    expect(screen.queryByRole("button", { name: "Save as smart backlog" })).toBeNull();
  });

  it("is not offered to a person who may not manage backlogs", async () => {
    at("/a/hub-1/backlogs/all?tag=Software", false, []);
    await screen.findByText("Import the municipality");
    expect(screen.queryByRole("button", { name: "Save as smart backlog" })).toBeNull();
  });

  it("becomes a link to the smart backlog that already has the same rules", async () => {
    const same: RuleSet = { match: "all", rules: [{ field: "backlog", operator: "is", value: "Software" }] };
    at("/a/hub-1/backlogs/all?tag=Software", true, [existing(same)]);
    expect(screen.queryByRole("button", { name: "Save as smart backlog" })).toBeNull();
    await userEvent.click(await screen.findByRole("link", { name: "Open Software here" }));
    expect(await screen.findByText("the smart backlog")).toBeInTheDocument();
  });
});
