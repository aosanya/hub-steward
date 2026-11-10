import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { accessTools } from "../../backlogAccess/api";
import { backlogTools } from "../../backlogManage/api";
import { taskTools } from "../../backlogs/api";
import { beforeEachJourney, endInAgencies, farmers, inFarmers, issueRow, states, where } from "./backlogs.test-support";

beforeEach(beforeEachJourney);

afterEach(endInAgencies);

const placed = [
  issueRow({ id: "t1", title: "Import the boards", rank: 2, status: "blocked", state: "Waiting" }),
  issueRow({ id: "t2", title: "Write the manual", rank: 1, state: "To do" }),
  issueRow({ id: "t3", title: "Write the loader", rank: 3, status: "in_progress", state: "Doing" }),
  issueRow({ id: "t4", title: "Write the plan", rank: 4, state: "To do" }),
];

const world = {
  [taskTools.list]: () => ({ items: placed }),
};

const manager = { [backlogTools.myRoles]: () => ({ permissions: ["task.read", "task.edit", "backlog.manage"] }) };

const supportBacklog = (held: number[]) => ({
  id: "support",
  name: "Support",
  issues: held.reduce((sum, one) => sum + one, 0),
  steps: ["New", "Answering", "Closed"].slice(0, held.length).map((name, at) => ({ id: name.toLowerCase(), name, issues: held[at] })),
});

describe("journey 03, work the backlogs", () => {
  it("1. the Backlogs screen lists All issues and a row for each backlog with its number of steps and issues", async () => {
    inFarmers("/backlogs", world);
    expect(await screen.findByText("4 issues")).toBeInTheDocument();
    expect(screen.getByText("All issues")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("5 steps · 4 issues")).toBeInTheDocument();
  });

  it("1. a new hub has one backlog with To do, Doing, Waiting, Done and Cancelled", async () => {
    inFarmers("/backlogs/backlog/board", world);
    await screen.findByRole("region", { name: "To do" });
    expect(screen.getAllByRole("region").map((one) => one.getAttribute("aria-label"))).toEqual(states);
  });

  it("1. a freshly loaded issue is at its first step", async () => {
    inFarmers("/backlogs/backlog/board", { [taskTools.list]: () => ({ items: [issueRow({ id: "n1", title: "Fresh", state: "", step: "to-do", backlog: "backlog" })] }) });
    const first = await screen.findByRole("region", { name: "To do" });
    expect(within(first).getByText("Fresh")).toBeInTheDocument();
  });

  it("2. tapping a backlog opens its board, and the Backlog link opens its page", async () => {
    inFarmers("/backlogs", world);
    await userEvent.click(await screen.findByText("Backlog"));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/backlog/board`);
    await userEvent.click(await screen.findByRole("link", { name: "Backlog" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/backlog/page`);
  });

  it("2. the page shows the steps in order with the counts of the board", async () => {
    inFarmers("/backlogs/backlog/page", world);
    await screen.findByText("Steps, in order");
    const rows = states.map((name) => screen.getByText(name).closest(".row") as HTMLElement);
    expect(rows.map((row) => row.textContent)).toEqual(["To do2 issues", "Doing1 issue", "Waiting1 issue", "Done0 issues", "Cancelled0 issues"]);
  });

  it("2. the page shows the groups with access", async () => {
    inFarmers("/backlogs/backlog/page", {
      ...world,
      [accessTools.list]: () => ({ owner_group: "g1", groups: [{ group_id: "g1", level: "move" }] }),
      [accessTools.groups]: () => ({ items: [{ id: "g1", name: "Product owner" }] }),
    });
    expect(await screen.findByText("Who has access")).toBeInTheDocument();
    expect(screen.getByText("Product owner")).toBeInTheDocument();
    expect(screen.getByText("Can edit")).toBeInTheDocument();
  });

  it("3. the owner adds a backlog from the Backlogs screen with its steps in order", async () => {
    const world = inFarmers("/backlogs", { ...manager, [backlogTools.create]: () => ({ id: "support" }) });
    await userEvent.click(await screen.findByRole("button", { name: "Add a backlog" }));
    await userEvent.click(screen.getByText("Backlog with steps"));
    await userEvent.type(await screen.findByLabelText("Name"), "Support");
    for (const step of ["New", "Answering", "Closed"]) {
      await userEvent.type(screen.getByLabelText("New step"), step);
      await userEvent.click(screen.getByRole("button", { name: "Add a step" }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Create the backlog" }));
    await waitFor(() => expect(world.named(backlogTools.create)[0]?.args).toMatchObject({ name: "Support", steps: ["New", "Answering", "Closed"] }));
    expect(await screen.findByText("All issues")).toBeInTheDocument();
  });

  it("3. a step is added on a backlog's Edit screen", async () => {
    const world = inFarmers("/backlogs/support/edit", { ...manager, [backlogTools.list]: () => ({ items: [supportBacklog([0, 0, 0])] }), [backlogTools.addStep]: () => supportBacklog([0, 0, 0]) });
    await userEvent.type(await screen.findByLabelText("New step"), "Escalated");
    await userEvent.click(screen.getByRole("button", { name: "Add a step" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(world.named(backlogTools.addStep)[0]?.args).toMatchObject({ backlogID: "support", name: "Escalated" }));
  });

  it("5. a step that holds issues cannot be removed and a backlog that holds issues cannot be deleted, and the screen says how many", async () => {
    inFarmers("/backlogs/support/edit", { ...manager, [backlogTools.list]: () => ({ items: [supportBacklog([0, 3, 0])] }) });
    expect(await screen.findByText("3 issues")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Answering" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete the backlog" })).toBeDisabled();
    expect(screen.getByText("It still holds 3 issues.")).toBeInTheDocument();
  });

  it("5. once the step is empty the removal works", async () => {
    const world = inFarmers("/backlogs/support/edit", { ...manager, [backlogTools.list]: () => ({ items: [supportBacklog([0, 0, 0])] }), [backlogTools.removeStep]: () => supportBacklog([0, 0]) });
    await userEvent.click(await screen.findByRole("button", { name: "Remove Answering" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(world.named(backlogTools.removeStep)[0]?.args).toMatchObject({ backlogID: "support", stepID: "answering" }));
  });

  it("6. the access screen offers Can see, Can move and Can edit, and choosing a level gives it to the group", async () => {
    const world = inFarmers("/backlogs/support/access", {
      ...manager,
      [backlogTools.list]: () => ({ items: [supportBacklog([0, 0, 0])] }),
      [accessTools.groups]: () => ({ items: [{ id: "po", name: "Product owner", hierarchy_id: "h1" }, { id: "members", name: "Backlog members", hierarchy_id: "h1" }] }),
      [accessTools.list]: () => ({ owner_group: "po", groups: [{ group_id: "members", level: "see", roles: ["backlog_member"] }] }),
    });
    const group = await screen.findByRole("group", { name: "Access for Backlog members" });
    expect(within(group).getAllByRole("button").map((one) => one.textContent)).toEqual(["Can see", "Can move", "Can edit"]);
    await userEvent.click(within(group).getByRole("button", { name: "Can edit" }));
    await waitFor(() => expect(world.named(accessTools.give)[0]?.args).toMatchObject({ backlogID: "support", groupID: "members", level: "edit" }));
  });

  it("7. a role without the manage permission sees the Backlogs and no Add a backlog button", async () => {
    const reader = { [backlogTools.myRoles]: () => ({ permissions: ["task.read"] }) };
    inFarmers("/backlogs", reader);
    await screen.findByText("All issues");
    expect(screen.queryByRole("button", { name: "Add a backlog" })).toBeNull();
  });

  it("7. the Edit screen says that the role cannot change backlogs", async () => {
    inFarmers("/backlogs/support/edit", { [backlogTools.myRoles]: () => ({ permissions: ["task.read"] }) });
    expect(await screen.findByText("Your role cannot change backlogs.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("7. the Access screen says that the role cannot change who has access", async () => {
    inFarmers("/backlogs/support/access", { [backlogTools.myRoles]: () => ({ permissions: ["task.read"] }) });
    expect(await screen.findByText("Your role cannot change who has access to backlogs.")).toBeInTheDocument();
  });

  it.todo("3. the new backlog is seen only by the Product owner group until another group is given access; the hub decides it and journey 03's walk record has it on the hub, no app test");

  it.todo("4. 'move 2 to Doing' and 'move 4 to Documentation' leave the issue at one step of one backlog with its mark unchanged; the assistant page offers no move tool yet (SW98, SW101)");

  it.todo("6. a Backlog member sees the Documentation backlog after it is given and still not the Support backlog; the hub filters the list, the screen shows what it is sent");

  it.todo("7. the task module refuses a Backlog worker's manage call and a Backlog member's move; the refusal is the hub's and is walked on the hub, no app test");
});
