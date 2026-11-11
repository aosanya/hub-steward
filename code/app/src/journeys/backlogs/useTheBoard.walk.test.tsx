import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { openAgency } from "../../agency/open";
import { BacklogSummariesProvider } from "../../chat/backlogCards/summaries";
import type { RoomMessage, RoomsClient } from "../../chat/rooms/api";
import { Attachment } from "../../chat/rooms/cards";
import { beforeEachJourney, endInAgencies, farmers, inFarmers, issueRow, states, where } from "./backlogs.test-support";
import { taskTools } from "../../backlogs/api";

beforeEach(beforeEachJourney);

afterEach(endInAgencies);

const board = "/backlogs/backlog/board";

const placed = [
  issueRow({ id: "t1", title: "Import the boards", rank: 2, status: "blocked", state: "Waiting", project_name: "hub-steward-swe", tags: ["Docs", "Blocked"] }),
  issueRow({ id: "t2", title: "Write the manual", rank: 1, state: "To do", project_name: "mwanachama-docs", tags: ["Docs"] }),
  issueRow({ id: "t3", title: "Write the loader", rank: 3, state: "Doing", project_name: "hub-steward-swe", tags: ["Software"] }),
  issueRow({ id: "t4", title: "Close the sprint", rank: 4, status: "completed", state: "Done", project_name: "hub-steward-swe" }),
];

const withPlacedIssues = { [taskTools.list]: () => ({ items: placed }) };

const column = (step: string) => screen.getByRole("region", { name: step });

const boardCard: RoomMessage = {
  id: "m1",
  author: "Triager",
  agent: true,
  mine: false,
  body: "",
  at: "2026-11-09T09:12:00Z",
  kind: "backlog_view",
  targetId: "backlog:backlog",
};

function Here() {
  const { pathname } = useLocation();
  return <output data-testid="here">{pathname}</output>;
}

describe("journey 06, use the board", () => {
  it("1. the chat card for a board does not move the app until Open is tapped", async () => {
    openAgency(farmers.id);
    render(
      <MemoryRouter initialEntries={[`/a/${farmers.id}/chat/r1`]}>
        <BacklogSummariesProvider backlogs={[{ id: "backlog", name: "Backlog", steps: 5, issues: 4 }]} totals={{ issues: 4 }}>
          <Attachment message={boardCard} threadLabel="General" client={{} as RoomsClient} openAsk={() => {}} />
        </BacklogSummariesProvider>
        <Here />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("here")).toHaveTextContent(`/a/${farmers.id}/chat/r1`);
    await userEvent.click(screen.getByRole("link", { name: "Open" }));
    expect(screen.getByTestId("here")).toHaveTextContent(`/a/${farmers.id}/backlogs/backlog/board`);
  });

  it("1. tapping a backlog's row on the Backlogs screen opens that backlog's board", async () => {
    inFarmers("/backlogs", withPlacedIssues);
    await userEvent.click(await screen.findByText("Backlog"));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/backlog/board`);
  });

  it("1. the board of the backlog opens at its board path", async () => {
    inFarmers(board, withPlacedIssues);
    expect(await screen.findByRole("region", { name: "To do" })).toBeInTheDocument();
    expect(where()).toBe(`/a/${farmers.id}${board}`);
  });

  it("2. the columns are the steps of the backlog in order", async () => {
    inFarmers(board, withPlacedIssues);
    await screen.findByRole("region", { name: "To do" });
    expect(screen.getAllByRole("region").map((one) => one.getAttribute("aria-label"))).toEqual(states);
  });

  it("2. every issue of the backlog is in exactly one column and the count under the title is the number of issues", async () => {
    inFarmers(board, withPlacedIssues);
    await screen.findByRole("region", { name: "To do" });
    expect(within(column("To do")).getByText("Write the manual")).toBeInTheDocument();
    expect(within(column("Doing")).getByText("Write the loader")).toBeInTheDocument();
    expect(within(column("Waiting")).getByText("Import the boards")).toBeInTheDocument();
    expect(within(column("Done")).getByText("Close the sprint")).toBeInTheDocument();
    expect(document.querySelectorAll(".bb-col > .card")).toHaveLength(4);
    expect(screen.getByText(/^4 issues · 5 steps$/)).toBeInTheDocument();
  });

  it("2. the back arrow returns to the Backlogs screen and the tab bar shows", async () => {
    inFarmers(board, withPlacedIssues);
    await screen.findByRole("region", { name: "To do" });
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs`);
  });

  it("4. a tag in the address filters every column at once, shows a chip with a cross, and follows the counts", async () => {
    inFarmers(`${board}?tag=Docs`, withPlacedIssues);
    await screen.findByRole("region", { name: "To do" });
    expect(document.querySelectorAll(".bb-col > .card")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Docs ✕" })).toBeInTheDocument();
    expect(within(column("Doing")).getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText(/^2 issues · 5 steps$/)).toBeInTheDocument();
  });

  it("4. clearing a chip brings the cards back", async () => {
    inFarmers(`${board}?tag=Docs`, withPlacedIssues);
    await screen.findByRole("button", { name: "Docs ✕" });
    await userEvent.click(screen.getByRole("button", { name: "Docs ✕" }));
    await waitFor(() => expect(document.querySelectorAll(".bb-col > .card")).toHaveLength(4));
  });

  it("5. the List | Board switch opens the list with the same issues", async () => {
    inFarmers(board, withPlacedIssues);
    await screen.findByRole("region", { name: "To do" });
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/backlog`);
    for (const title of placed.map((one) => String(one.title))) {
      expect(await screen.findByRole("button", { name: new RegExp(`^${title}`) })).toBeInTheDocument();
    }
  });

  it("5. the list has the same List | Board switch and Board returns to the board", async () => {
    inFarmers("/backlogs/backlog", withPlacedIssues);
    await userEvent.click(await screen.findByRole("button", { name: "Board" }));
    expect(where()).toBe(`/a/${farmers.id}${board}`);
  });

  it("5. the Backlog link opens the backlog's page", async () => {
    inFarmers(board, withPlacedIssues);
    await screen.findByRole("region", { name: "To do" });
    await userEvent.click(screen.getByRole("link", { name: "Backlog" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/backlog/page`);
  });

  it.todo("3. another backlog's row opens its board with its own steps and no issue in two backlogs (needs more than one backlog: SW15 and SW20 in the module)");

  it.todo("6. 'move 2 to Doing' answers one line and the board shows the card in Doing only, mark unchanged (Triager reply and the move tool, SW17)");
});
