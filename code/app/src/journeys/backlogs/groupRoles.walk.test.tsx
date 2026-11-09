import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { accessTools } from "../../backlogAccess/api";
import { noRoleWords, nothingSharedWords } from "../../backlogs/access";
import { backlogTools } from "../../backlogManage/api";
import { taskTools } from "../../backlogs/api";
import { beforeEachJourney, endInAgencies, hubBacklogsFor, inFarmers, issues } from "./backlogs.test-support";

beforeEach(beforeEachJourney);

afterEach(endInAgencies);

type Grant = { group_id: string; level: "see" | "move"; roles: string[]; role_too_small?: boolean; no_role?: boolean };

const groupNames = [
  { id: "po", name: "Product owner", hierarchy_id: "h1" },
  { id: "support", name: "Support", hierarchy_id: "h1" },
  { id: "contributors", name: "Contributors", hierarchy_id: "h1" },
];

const roleOf = (level: "see" | "move") => (level === "move" ? ["backlog_worker"] : ["backlog_member"]);

const hubWithGrants = (start: Grant[]) => {
  let grants = start;
  return {
    [backlogTools.myRoles]: () => ({ permissions: ["task.read", "task.edit", "backlog.manage"] }),
    [backlogTools.list]: () => ({ items: [{ id: "software", name: "Software", issues: 0, steps: [{ id: "to-do", name: "To do", issues: 0 }] }] }),
    [accessTools.groups]: () => ({ items: groupNames }),
    [accessTools.list]: () => ({ owner_group: "po", groups: grants }),
    [accessTools.give]: (args: Record<string, unknown>) => {
      const level = args.level === "move" ? "move" : "see";
      grants = [...grants.filter((one) => one.group_id !== args.groupID), { group_id: String(args.groupID), level, roles: roleOf(level) }];
      return {};
    },
    [accessTools.take]: (args: Record<string, unknown>) => {
      grants = grants.filter((one) => one.group_id !== args.groupID);
      return {};
    },
  };
};

const cardOf = async (name: string) => (await screen.findByText(name)).closest("section") as HTMLElement;

const aMember = (permissions: string[], backlogs: unknown) => ({
  [backlogTools.myRoles]: () => ({ permissions }),
  [taskTools.backlogs]: () => backlogs,
});

const software = { items: [{ id: "software", name: "Software", issues: 3, steps: [{ id: "to-do", name: "To do", issues: 3 }] }] };

describe("journey 07, group roles", () => {
  it("1. a member whose roles hold no task.read is told to ask the Product owner, on the Backlogs and on a board", async () => {
    const world = inFarmers("/backlogs", aMember([], hubBacklogsFor(issues)));
    expect(await screen.findByText(noRoleWords)).toBeInTheDocument();
    expect(screen.queryByText("All issues")).toBeNull();
    expect(world.named(taskTools.list)).toHaveLength(0);
  });

  it("1. the same words stand on a link to a board", async () => {
    inFarmers("/backlogs/backlog/board", aMember(["chat.post"], hubBacklogsFor(issues)));
    expect(await screen.findByText(noRoleWords)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "To do" })).toBeNull();
  });

  it("2. the owner adds the group at Can see and the Access page shows it using the Backlogs as Backlog member", async () => {
    const world = inFarmers("/backlogs/software/access", hubWithGrants([]));
    await userEvent.click(await screen.findByRole("button", { name: "Add a group" }));
    await userEvent.click(screen.getByText("Support"));
    await waitFor(() => expect(world.named(accessTools.give)[0]?.args).toMatchObject({ backlogID: "software", groupID: "support", level: "see" }));
    expect(await within(await cardOf("Support")).findByText("Uses the Backlogs as: Backlog member")).toBeInTheDocument();
  });

  it("3. a member with a role and no shared backlog sees that nothing is shared and no way to add one", async () => {
    inFarmers("/backlogs", aMember(["task.read"], { items: [] }));
    expect(await screen.findByText(nothingSharedWords)).toBeInTheDocument();
    expect(screen.queryByText("All issues")).toBeNull();
    expect(screen.queryByText(noRoleWords)).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a backlog" })).toBeNull();
  });

  it("4. a member of a group with Can see opens the shared backlog and sees no Add or Edit control", async () => {
    inFarmers("/backlogs", aMember(["task.read"], software));
    expect(await screen.findByText("Software")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a backlog" })).toBeNull();
    await userEvent.click(screen.getByText("Software"));
    await userEvent.click(await screen.findByRole("link", { name: "Backlog" }));
    await screen.findByText("Steps, in order");
    expect(screen.queryByRole("link", { name: "Edit this backlog" })).toBeNull();
  });

  it("6. a group at Can move with a role too small shows the warning, and giving Can move again gives the bigger role and clears it", async () => {
    inFarmers("/backlogs/software/access", hubWithGrants([{ group_id: "contributors", level: "move", roles: ["backlog_member"], role_too_small: true }]));
    expect(await within(await cardOf("Contributors")).findByText("This group's role is too small to move issues")).toBeInTheDocument();
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can see" }));
    await userEvent.click(within(await cardOf("Contributors")).getByRole("button", { name: "Can move" }));
    expect(await within(await cardOf("Contributors")).findByText("Uses the Backlogs as: Backlog worker")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("This group's role is too small to move issues")).toBeNull());
  });

  it("7. taking the group's access away removes its card and offers the group again under Add a group", async () => {
    const world = inFarmers("/backlogs/software/access", hubWithGrants([{ group_id: "support", level: "see", roles: ["backlog_member"] }]));
    await userEvent.click(within(await cardOf("Support")).getByRole("button", { name: "No access" }));
    await userEvent.click(await screen.findByRole("button", { name: "Take away" }));
    await waitFor(() => expect(world.named(accessTools.take)[0]?.args).toMatchObject({ backlogID: "software", groupID: "support" }));
    await waitFor(() => expect(screen.queryByText("Support")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Add a group" }));
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it.todo("5. the highest level any of a person's groups holds wins; this is the task module's rule and is walked on the server (take-up-64)");

  it.todo("7. a member whose group lost its role is back at step 1 on the next open; this needs a hub whose roles change between two opens");
});
