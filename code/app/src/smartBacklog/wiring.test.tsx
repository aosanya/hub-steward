import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { BacklogsPage } from "../backlogs/BacklogsPage";
import type { Issue } from "../backlogs/api";
import { McpError } from "../wakala/mcp";
import { choicesOf, mcpSmartBacklogClient, setOf, smartOf, smartTools } from "./api";
import { AddSmartBacklogScreen, EditSmartBacklogScreen } from "./SmartScreens";
import { SmartBacklogPage } from "./SmartBacklogPage";
import { DuplicateRules, type FieldChoices, type RuleSet, type SmartBacklogClient } from "./types";
import { rulesWords } from "./words";

const calls: [string, any][] = [];

let answer: (name: string, args: any) => Promise<any> = async () => ({});

vi.mock("../wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../wakala/mcp")>("../wakala/mcp");
  return {
    ...actual,
    callTool: (_hub: string, name: string, args: any) => {
      calls.push([name, args]);
      return answer(name, args);
    },
  };
});

beforeEach(() => {
  openAgency("hub-1");
  calls.length = 0;
  answer = async () => ({});
});

afterEach(() => forgetOpenAgency());

const choices: FieldChoices = { tag: ["Docs"], mark: ["Ready", "Blocked"], backlog: ["Software"], step: ["To do", "Doing"], priority: ["P1"] };

const readySet: RuleSet = { match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }, { field: "step", operator: "is", value: "To do" }] };

const issue = (id: string, title: string): Issue => ({ id, title, description: "", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Software", mark: "Ready", rank: 1 });

const fake = (over: Partial<SmartBacklogClient> = {}): SmartBacklogClient => ({
  choices: async () => choices,
  count: async () => 3,
  create: async () => "smart-1",
  read: async (id) => ({ id, name: "Ready to start", set: readySet, issues: 2 }),
  update: async () => undefined,
  ...over,
});

const may = (allowed: boolean) => ({ mayManage: async () => allowed }) as never;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const where = () => screen.getByTestId("where").textContent;

describe("the Backlogs screen with smart backlogs", () => {
  const backlogs = [
    { id: "software", name: "Software", steps: ["To do", "Doing"], issues: 5 },
    { id: "ready", name: "Ready to start", steps: [], issues: 3, kind: "smart" as const },
  ];
  const show = () =>
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs"]}>
        <BacklogsPage client={{ backlogs: async () => backlogs, issues: async () => [], issue: async () => ({}) as never }} manage={may(true)} agency={{ read: async () => ({ name: "Hub Steward SWE" }) } as never} />
        <Where />
      </MemoryRouter>,
    );

  it("lists a smart backlog with a Smart pill and only its count", async () => {
    show();
    const row = (await screen.findByText("Ready to start")).closest("button") as HTMLElement;
    expect(within(row).getByText("Smart")).toBeInTheDocument();
    expect(within(row).getByText("3 issues")).toBeInTheDocument();
    expect(within(row).queryByText(/step/)).toBeNull();
  });

  it("opens a smart backlog from its row, not a board", async () => {
    show();
    await userEvent.click(await screen.findByText("Ready to start"));
    expect(where()).toBe("/a/hub-1/backlogs/ready/smart");
  });

  it("asks which kind first when Add a backlog is tapped", async () => {
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Add a backlog" }));
    const sheet = screen.getByRole("dialog", { name: "Add a backlog" });
    await userEvent.click(within(sheet).getByRole("button", { name: /Smart backlog/ }));
    expect(where()).toBe("/a/hub-1/backlogs/new/smart");
  });
});

describe("one smart backlog opened", () => {
  const open = (client: SmartBacklogClient, issues: Issue[], allowed = true) =>
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/ready/smart"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/:backlogId/smart" element={<SmartBacklogPage client={client} issues={{ issues: async () => issues } as never} manage={may(allowed)} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

  it("reads the rules back, counts the issues and offers Edit rules to a manager, with no Board switch", async () => {
    open(fake(), [issue("t1", "Record the voice clips"), issue("t2", "Add the backlog tools")]);
    expect(await screen.findByText("Mark is Ready · Step is To do")).toBeInTheDocument();
    expect(screen.getByText("Smart")).toBeInTheDocument();
    expect(screen.getByText("2 issues")).toBeInTheDocument();
    expect(screen.getByText(/Record the voice clips/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit rules" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Board" })).toBeNull();
  });

  it("shows the empty card with Edit rules inside it when nothing matches", async () => {
    open(fake(), []);
    const card = (await screen.findByText("Nothing matches yet")).closest("section, div") as HTMLElement;
    await userEvent.click(within(card.parentElement as HTMLElement).getAllByRole("button", { name: "Edit rules" }).at(-1) as HTMLElement);
    expect(where()).toBe("/a/hub-1/backlogs/ready/rules");
  });

  it("hides Edit rules from a role that may not manage backlogs", async () => {
    open(fake(), [issue("t1", "Record the voice clips")], false);
    await screen.findByText("Mark is Ready · Step is To do");
    expect(screen.queryByRole("button", { name: "Edit rules" })).toBeNull();
  });
});

describe("adding and editing a smart backlog", () => {
  const add = (client: SmartBacklogClient) =>
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/new/smart"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/new/smart" element={<AddSmartBacklogScreen client={client} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

  const fillAndCreate = async () => {
    await userEvent.type(await screen.findByLabelText("Name"), "Ready to start");
    await userEvent.click(screen.getByRole("button", { name: "+ Add a rule" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Rule on" })).getByRole("button", { name: "Mark" }));
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
  };

  it("creates the smart backlog and opens it", async () => {
    const create = vi.fn().mockResolvedValue("smart-9");
    add(fake({ create }));
    await fillAndCreate();
    await waitFor(() => expect(where()).toBe("/a/hub-1/backlogs/smart-9/smart"));
    expect(create).toHaveBeenCalledWith("Ready to start", { match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }] });
  });

  it("refuses the same rules twice and links to the backlog that has them", async () => {
    add(fake({ create: async () => Promise.reject(new DuplicateRules("ready", "Ready to start")) }));
    await fillAndCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("Ready to start already has these rules.");
    await userEvent.click(screen.getByRole("button", { name: "Open Ready to start" }));
    expect(where()).toBe("/a/hub-1/backlogs/ready/smart");
  });

  it("edits the rules of a smart backlog and saves them", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/ready/rules"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/:backlogId/rules" element={<EditSmartBacklogScreen client={fake({ update })} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("Name")).toHaveValue("Ready to start");
    expect(screen.getByLabelText("Value of rule 2")).toHaveValue("To do");
    await userEvent.click(screen.getByRole("button", { name: "Remove rule 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("ready", "Ready to start", { match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }] }));
    expect(where()).toBe("/a/hub-1/backlogs/ready/smart");
  });
});

describe("the smart backlog client", () => {
  it("reads rules and counts out of the backlog list", () => {
    expect(smartOf({ id: "r", name: "Ready", issues: 3, rules: { match: "any", rules: [{ field: "tag", operator: "has", value: "Docs" }] } })).toEqual({
      id: "r",
      name: "Ready",
      issues: 3,
      set: { match: "any", rules: [{ field: "tag", operator: "has", value: "Docs" }] },
    });
    expect(setOf(undefined)).toEqual({ match: "all", rules: [] });
  });

  it("offers the values that exist on the issues, and Ready and Blocked", () => {
    expect(choicesOf([{ topics: ["Docs"], repo: "hub-steward", step: "To do", backlog: "Software", priority: "P1" }, { topics: [], repo: "hub-steward", step: "", backlog: "Software" }])).toEqual({
      tag: ["Docs", "hub-steward"],
      mark: ["Ready", "Blocked"],
      backlog: ["Software"],
      step: ["To do"],
      priority: ["P1"],
    });
  });

  it("reads rules back in words, joined by or for Match any", () => {
    expect(rulesWords(readySet)).toBe("Mark is Ready · Step is To do");
    expect(rulesWords({ ...readySet, match: "any" })).toBe("Mark is Ready or Step is To do");
  });

  it("sends the name and the rules together on create and counts through the count tool", async () => {
    answer = async (name) => (name === smartTools.count ? { count: 4 } : { id: "new-1" });
    expect(await mcpSmartBacklogClient.create("Ready to start", readySet)).toBe("new-1");
    expect(await mcpSmartBacklogClient.count(readySet)).toBe(4);
    expect(calls).toEqual([
      [smartTools.create, { name: "Ready to start", rules: readySet }],
      [smartTools.count, { rules: readySet }],
    ]);
  });

  it("turns the hub's duplicate refusal into DuplicateRules carrying the existing backlog", async () => {
    answer = async () => Promise.reject(new McpError('taskmanager_backlog_create: these rules already exist {"existing_id":"ready","existing_name":"Ready to start"}'));
    await expect(mcpSmartBacklogClient.create("Next up", readySet)).rejects.toMatchObject({ existingId: "ready", existingName: "Ready to start" });
  });
});
