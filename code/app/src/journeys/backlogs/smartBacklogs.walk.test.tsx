import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { accessTools } from "../../backlogAccess/api";
import { backlogTools } from "../../backlogManage/api";
import { taskTools } from "../../backlogs/api";
import { sendTools } from "../../sendToBacklog";
import { smartTools } from "../../smartBacklog/api";
import { beforeEachJourney, endInAgencies, farmers, openApp, where } from "./backlogs.test-support";

beforeEach(beforeEachJourney);

afterEach(endInAgencies);

type Args = Record<string, unknown>;

type Row = { id: string; title: string; status: string; backlog: string; step: string; project_name: string; rank: number };

type Rule = { field: string; operator: string; value: string };

type RuleSet = { match: string; rules: Rule[] };

type Smart = { id: string; name: string; rules: RuleSet };

type Step = { id: string; name: string };

type Levels = Record<string, string>;

class Refusal {
  constructor(readonly text: string) {}
}

const owner = ["task.read", "task.edit", "backlog.manage"];

const worker = ["task.read", "task.edit"];

const ownerLevels: Levels = { software: "edit", documentation: "edit", support: "edit", ready: "edit" };

const workerLevels: Levels = { software: "move", documentation: "see", support: "see", ready: "see" };

const memberLevels: Levels = { software: "see", documentation: "see", support: "see", ready: "see" };

const stepsOf: Record<string, Step[]> = {
  software: [
    { id: "to-do", name: "To do" },
    { id: "doing", name: "Doing" },
  ],
  documentation: [
    { id: "draft", name: "Draft" },
    { id: "writing", name: "Writing" },
  ],
  support: [
    { id: "to-do", name: "To do" },
    { id: "answering", name: "Answering" },
  ],
};

const names: Record<string, string> = { software: "Software", documentation: "Documentation", support: "Support" };

const row = (id: string, title: string, rank: number, over: Partial<Row> = {}): Row => ({ id, title, status: "pending", backlog: "software", step: "to-do", project_name: "hub-steward", rank, ...over });

const readyRules: RuleSet = { match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }, { field: "step", operator: "is", value: "To do" }] };

const keyOf = (set: RuleSet) => JSON.stringify({ match: set.match, rules: [...set.rules].map((rule) => JSON.stringify(rule)).sort() });

const hub = (over: { permissions?: string[]; levels?: Levels; withReady?: boolean; seeded?: Smart[] } = {}) => {
  const permissions = over.permissions ?? owner;
  const levels = over.levels ?? ownerLevels;
  const rows: Row[] = [
    row("t1", "Record the voice clips", 1),
    row("t2", "Add the backlog tools", 2),
    row("t3", "Switch on the custody module", 3),
    row("t4", "Fix the import route", 4, { step: "doing" }),
    row("t5", "Import the municipality", 5, { status: "blocked" }),
  ];
  const smarts: Smart[] = [...(over.withReady === false ? [] : [{ id: "ready", name: "Ready to start", rules: readyRules }]), ...(over.seeded ?? [])];
  const grants: { group_id: string; level: string }[] = [{ group_id: "po", level: "edit" }];
  const stepName = (one: Row) => stepsOf[one.backlog].find((step) => step.id === one.step)?.name ?? "";
  const holds = (one: Row, rule: Rule) => {
    const negative = ["is_not", "does_not_have", "does_not_contain"].includes(rule.operator);
    const hit =
      rule.field === "mark"
        ? (one.status === "blocked" ? "Blocked" : "Ready") === rule.value
        : rule.field === "step"
          ? stepName(one) === rule.value
          : rule.field === "backlog"
            ? names[one.backlog] === rule.value
            : rule.field === "tag"
              ? [one.project_name, names[one.backlog]].includes(rule.value)
              : rule.field === "title"
                ? one.title.toLowerCase().includes(rule.value.toLowerCase())
                : false;
    return negative ? !hit : hit;
  };
  const matching = (set: RuleSet) => rows.filter((one) => (set.match === "any" ? set.rules.some((rule) => holds(one, rule)) : set.rules.every((rule) => holds(one, rule))));
  const raw = (one: Row) => ({ ...one, tags: [] as string[] });
  const backlogItems = () => [
    ...Object.keys(stepsOf).map((id) => ({
      id,
      name: names[id],
      level: levels[id],
      issues: rows.filter((one) => one.backlog === id).length,
      steps: stepsOf[id].map((step) => ({ ...step, issues: rows.filter((one) => one.backlog === id && one.step === step.id).length })),
    })),
    ...smarts.map((one) => ({ id: one.id, name: one.name, kind: "smart", level: levels.ready, rules: one.rules, issues: matching(one.rules).length, steps: [] })),
  ];
  const replies: Record<string, (args: Args) => unknown> = {
    [backlogTools.myRoles]: () => ({ permissions }),
    [taskTools.backlogs]: () => ({ items: backlogItems() }),
    [taskTools.list]: (args) => {
      const asked = String(args.backlog ?? "");
      const smart = smarts.find((one) => one.id === asked);
      return { items: (smart ? matching(smart.rules) : asked === "" ? rows : rows.filter((one) => one.backlog === asked)).map(raw) };
    },
    [smartTools.count]: (args) => ({ count: matching(args.rules as RuleSet).length }),
    [smartTools.create]: (args) => {
      const set = args.rules as RuleSet;
      const same = smarts.find((one) => keyOf(one.rules) === keyOf(set));
      if (same) return new Refusal(`these rules already exist {"existing_id":"${same.id}","existing_name":"${same.name}"}`);
      const made = { id: `smart-${smarts.length + 1}`, name: String(args.name), rules: set };
      smarts.push(made);
      return { id: made.id };
    },
    [sendTools.move]: (args) => {
      const moved = rows.find((one) => one.id === args.taskID);
      if (moved) Object.assign(moved, { backlog: args.backlog, step: args.step });
      return {};
    },
    [accessTools.groups]: () => ({ items: [{ id: "po", name: "Product owner", hierarchy_id: "h1" }, { id: "members", name: "Backlog members", hierarchy_id: "h1" }] }),
    [accessTools.list]: () => ({ owner_group: "po", groups: grants }),
    [accessTools.give]: (args) => {
      const next = grants.filter((one) => one.group_id !== args.groupID);
      next.push({ group_id: String(args.groupID), level: String(args.level) });
      grants.splice(0, grants.length, ...next);
      return {};
    },
    [accessTools.take]: (args) => {
      grants.splice(0, grants.length, ...grants.filter((one) => one.group_id !== args.groupID));
      return {};
    },
  };
  return { rows, smarts, grants, replies, matching };
};

const serve = (replies: Record<string, (args: Args) => unknown>) => {
  const sent: { tool: string; args: Args }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      let result: unknown = {};
      if (body.method === "tools/call") {
        const args: Args = body.params.arguments ?? {};
        sent.push({ tool: String(body.params.name), args });
        const answer = replies[body.params.name]?.(args) ?? { items: [] };
        result = answer instanceof Refusal ? { isError: true, content: [{ type: "text", text: answer.text }] } : { structuredContent: answer };
      }
      const text = JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result });
      return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
    }),
  );
  return { sent, named: (tool: string) => sent.filter((call) => call.tool === tool) };
};

const walk = (path: string, over?: Parameters<typeof hub>[0]) => {
  const world = hub(over);
  const calls = serve(world.replies);
  openApp(`/a/${farmers.id}${path}`);
  return { ...world, ...calls };
};

const addRule = async (field: string) => {
  await userEvent.click(screen.getByRole("button", { name: "+ Add a rule" }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Rule on" })).getByRole("button", { name: field }));
};

const buildReadyRules = async (name: string) => {
  await userEvent.type(await screen.findByLabelText("Name"), name);
  await addRule("Mark");
  await addRule("Step");
  await userEvent.selectOptions(screen.getByLabelText("Value of rule 2"), "To do");
};

const listed = (...titles: string[]) => titles.forEach((title) => expect(screen.getByText(new RegExp(title))).toBeInTheDocument());

const absent = (...titles: string[]) => titles.forEach((title) => expect(screen.queryByText(new RegExp(title))).toBeNull());

describe("journey 09, smart backlogs", () => {
  const filterRules: RuleSet = {
    match: "all",
    rules: [{ field: "tag", operator: "has", value: "hub-steward" }, { field: "backlog", operator: "is", value: "Software" }, { field: "title", operator: "contains", value: "custody" }],
  };

  const filterByTwoTagsAndAWord = async () => {
    await screen.findByText(/Record the voice clips/);
    await userEvent.click(screen.getAllByRole("button", { name: "hub-steward" })[0]);
    await userEvent.click(screen.getAllByRole("button", { name: "Software" })[0]);
    await userEvent.type(screen.getByLabelText("Search issues"), "custody");
  };

  it("1. saves a filter as a smart backlog: two tags and a word fill the rules screen, and the new backlog is on the Backlogs screen with the same count", async () => {
    const world = walk("/backlogs/all");
    await filterByTwoTagsAndAWord();
    expect(await screen.findByText("1 of 5 issues")).toBeInTheDocument();
    listed("Switch on the custody module");
    absent("Record the voice clips", "Import the municipality");
    await userEvent.click(screen.getByRole("button", { name: "Save as smart backlog" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/new/smart`);
    expect(await screen.findByDisplayValue('hub-steward Software "custody"')).toBeInTheDocument();
    expect(screen.getByLabelText("Value of rule 1")).toHaveValue("hub-steward");
    expect(screen.getByLabelText("Value of rule 2")).toHaveValue("Software");
    expect(screen.getByLabelText("Value of rule 3")).toHaveValue("custody");
    expect(await screen.findByText("1 issue matches now")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    await waitFor(() => expect(where()).toBe(`/a/${farmers.id}/backlogs/smart-2/smart`));
    expect(world.named(smartTools.create)[0]?.args).toMatchObject({ name: 'hub-steward Software "custody"', rules: filterRules });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    const entry = (await screen.findByText('hub-steward Software "custody"')).closest("button") as HTMLElement;
    expect(within(entry).getByText("Smart")).toBeInTheDocument();
    expect(within(entry).getByText("1 issue")).toBeInTheDocument();
  });

  it("1. an unfiltered list has no Save as smart backlog button", async () => {
    walk("/backlogs/all");
    await screen.findByText(/Record the voice clips/);
    expect(screen.queryByRole("button", { name: "Save as smart backlog" })).toBeNull();
  });

  it("1. once a smart backlog has the same rules the Save button becomes a link to it", async () => {
    walk("/backlogs/all", { seeded: [{ id: "same", name: "Custody work", rules: { match: "all", rules: [...filterRules.rules].reverse() } }] });
    await filterByTwoTagsAndAWord();
    expect(await screen.findByRole("link", { name: "Open Custody work" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save as smart backlog" })).toBeNull();
  });

  it("2. builds one from rules: the line under the rules, the count on the Backlogs row and the rows of the opened list are the same number", async () => {
    const world = walk("/backlogs", { withReady: false });
    await userEvent.click(await screen.findByRole("button", { name: "Add a backlog" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Add a backlog" })).getByRole("button", { name: /Smart backlog/ }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/new/smart`);
    await buildReadyRules("Ready to start");
    expect(await screen.findByText("3 issues match now")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    await waitFor(() => expect(where()).toBe(`/a/${farmers.id}/backlogs/smart-1/smart`));
    expect(world.named(smartTools.create)[0]?.args).toMatchObject({ name: "Ready to start", rules: readyRules });
    expect(await screen.findByText("3 issues")).toBeInTheDocument();
    listed("Record the voice clips", "Add the backlog tools", "Switch on the custody module");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    const entry = (await screen.findByText("Ready to start")).closest("button") as HTMLElement;
    expect(within(entry).getByText("Smart")).toBeInTheDocument();
    expect(within(entry).getByText("3 issues")).toBeInTheDocument();
  });

  it("3. opens it: the Smart pill, the rules read back, the count, Edit rules and Select, no Board switch, and only Ready issues at To do", async () => {
    walk("/backlogs/ready/smart");
    expect(await screen.findByText("Mark is Ready · Step is To do")).toBeInTheDocument();
    expect(screen.getByText("Smart")).toBeInTheDocument();
    expect(screen.getByText("3 issues")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit rules" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Board" })).toBeNull();
    listed("Record the voice clips", "Add the backlog tools", "Switch on the custody module");
    absent("Fix the import route", "Import the municipality");
  });

  it("3. a role that may not manage backlogs sees the list without the Edit rules link", async () => {
    walk("/backlogs/ready/smart", { permissions: worker, levels: workerLevels });
    expect(await screen.findByText("Mark is Ready · Step is To do")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit rules" })).toBeNull();
  });

  it("4. the same rules twice are refused with a link to the backlog that has them, and Match any is a different set", async () => {
    const world = walk("/backlogs/new/smart");
    await buildReadyRules("Next up");
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ready to start already has these rules.");
    expect(world.smarts).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Open Ready to start" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/ready/smart`);
  });

  it("4. with Match any the same two rules are accepted", async () => {
    const world = walk("/backlogs/new/smart");
    await buildReadyRules("Next up");
    await userEvent.click(screen.getByRole("button", { name: "any" }));
    await userEvent.click(screen.getByRole("button", { name: "Create smart backlog" }));
    await waitFor(() => expect(world.smarts).toHaveLength(2));
    expect(world.smarts[1].rules.match).toBe("any");
  });

  it("5. selects two issues on the list and sends them: the sheet lists backlogs with steps and no smart backlog, and each lands at the first step of Documentation", async () => {
    const world = walk("/backlogs/ready/smart");
    await userEvent.click(await screen.findByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByLabelText("Select Record the voice clips"));
    await userEvent.click(screen.getByLabelText("Select Add the backlog tools"));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send to backlog" }));
    const sheet = await screen.findByRole("dialog", { name: "Send 2 issues to" });
    expect(within(sheet).getByText("Software")).toBeInTheDocument();
    expect(within(sheet).getByText("Support")).toBeInTheDocument();
    expect(within(sheet).queryByText("Ready to start")).toBeNull();
    await userEvent.click(within(sheet).getByText("Documentation"));
    expect(await screen.findByText("2 issues sent to Documentation")).toBeInTheDocument();
    expect(world.rows.filter((one) => one.backlog === "documentation").map((one) => [one.id, one.step])).toEqual([["t1", "draft"], ["t2", "draft"]]);
  });

  it("5. a role that may move only on Software sees only Software in the sheet", async () => {
    walk("/backlogs/ready/smart", { permissions: worker, levels: workerLevels });
    await userEvent.click(await screen.findByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByLabelText("Select Record the voice clips"));
    await userEvent.click(screen.getByRole("button", { name: "Send to backlog" }));
    const sheet = await screen.findByRole("dialog", { name: "Send 1 issue to" });
    expect(within(sheet).getByText("Software")).toBeInTheDocument();
    expect(within(sheet).queryByText("Documentation")).toBeNull();
    expect(within(sheet).queryByText("Support")).toBeNull();
  });

  it("5. a role that may only see has no Select at all", async () => {
    walk("/backlogs/ready/smart", { permissions: worker, levels: memberLevels });
    await screen.findByText(/Record the voice clips/);
    expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
  });

  it("6. after the send the smart backlog counts two fewer and the sent issues are not in it", async () => {
    const world = walk("/backlogs/ready/smart");
    world.rows.filter((one) => one.id === "t1" || one.id === "t2").forEach((one) => Object.assign(one, { backlog: "documentation", step: "draft" }));
    expect(await screen.findByText("1 issue")).toBeInTheDocument();
    listed("Switch on the custody module");
    absent("Record the voice clips", "Add the backlog tools");
    expect(world.matching(readyRules).map((one) => one.id)).toEqual(["t3"]);
  });

  it("6. an issue sent to a backlog whose first step is also named To do stays in the smart backlog", async () => {
    const world = walk("/backlogs/ready/smart");
    Object.assign(world.rows[0], { backlog: "support", step: "to-do" });
    expect(await screen.findByText("3 issues")).toBeInTheDocument();
    listed("Record the voice clips");
  });

  it("7. gives a group Can see on the smart backlog: the Access screen offers only Can see and Can edit", async () => {
    const world = walk("/backlogs/ready/access");
    await userEvent.click(await screen.findByRole("button", { name: "Add a group" }));
    await userEvent.click(screen.getByText("Backlog members"));
    await waitFor(() => expect(world.named(accessTools.give)[0]?.args).toMatchObject({ backlogID: "ready", groupID: "members", level: "see" }));
    const card = (await screen.findByText("Backlog members")).closest("section") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Can see" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Can edit" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Can move" })).toBeNull();
  });

  it("7. taking the access away removes the group's card", async () => {
    const world = walk("/backlogs/ready/access");
    world.grants.push({ group_id: "members", level: "see" });
    const card = (await screen.findByText("Backlog members")).closest("section") as HTMLElement;
    await userEvent.click(within(card).getByRole("button", { name: "Take away access from Backlog members" }));
    await userEvent.click(await screen.findByRole("button", { name: "Take away" }));
    await waitFor(() => expect(world.named(accessTools.take)[0]?.args).toMatchObject({ backlogID: "ready", groupID: "members" }));
    await waitFor(() => expect(screen.queryByText("Backlog members")).toBeNull());
  });

  it.todo("7. a member sees a lower count than the owner and none of the owner's extra issues: the task module narrows the count by groups and is walked on the server, in backlog_smart_test.go");

  it.todo("8. a member of a group with Can edit changes a rule and the count follows, a member with Can see has no Edit rules link (pending Q21)");
});
