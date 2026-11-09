import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    inFarmers("/backlogs/backlog/page", world);
    expect(await screen.findByText("Who has access")).toBeInTheDocument();
    expect(screen.getByText("Product owner")).toBeInTheDocument();
    expect(screen.getByText("Can move")).toBeInTheDocument();
  });

  it.todo("3. the manage screens add a backlog with its steps in order (take-up-11, SW34)");

  it.todo("3. the new backlog is seen only by the Product owner group until another group is given access (SW32, Q13 open)");

  it.todo("4. 'move 2 to Doing' and 'move 4 to Software' leave the issue at one step of one backlog with its mark unchanged (Triager and the move tool, SW17)");

  it.todo("5. removing a step or deleting a backlog that holds issues is refused naming the number, then works once empty (SW20 and the Edit screen)");

  it.todo("6. a group's level shows on the access screen and a Contributor's Backlogs screen lists no Documentation backlog (SW32, SW33, Q13 open)");

  it.todo("7. a role without the permission is refused by the module and sees the read-only pages (SW26)");
});
