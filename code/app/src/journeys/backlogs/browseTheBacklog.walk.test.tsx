import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { openAgency } from "../../agency/open";
import { BacklogSummariesProvider } from "../../chat/backlogCards/summaries";
import type { RoomMessage, RoomsClient } from "../../chat/rooms/api";
import { Attachment } from "../../chat/rooms/cards";
import { beforeEachJourney, endInAgencies, farmers, inFarmers, where } from "./backlogs.test-support";

beforeEach(beforeEachJourney);

afterEach(endInAgencies);

const allIssuesCard: RoomMessage = {
  id: "m1",
  author: "Triager",
  agent: true,
  mine: false,
  body: "",
  at: "2026-11-09T09:12:00Z",
  kind: "backlog_view",
  targetId: "all",
};

function Here() {
  const { pathname } = useLocation();
  return <output data-testid="here">{pathname}</output>;
}

describe("journey 02, browse the backlog", () => {
  it("1. asking to see the list answers with a card, and the screen does not change until Open is tapped", async () => {
    openAgency(farmers.id);
    render(
      <MemoryRouter initialEntries={[`/a/${farmers.id}/chat/r1`]}>
        <BacklogSummariesProvider backlogs={[]} totals={{ issues: 3 }}>
          <Attachment message={allIssuesCard} threadLabel="General" client={{} as RoomsClient} openAsk={() => {}} />
        </BacklogSummariesProvider>
        <Here />
      </MemoryRouter>,
    );
    expect(screen.getByText("3 issues")).toBeInTheDocument();
    expect(screen.getByTestId("here")).toHaveTextContent(`/a/${farmers.id}/chat/r1`);
    await userEvent.click(screen.getByRole("link", { name: "Open" }));
    expect(screen.getByTestId("here")).toHaveTextContent(`/a/${farmers.id}/backlogs/all`);
  });

  it("2. Open lists all issues in the rank the script gave, each row its title and its tags as bubbles", async () => {
    inFarmers("/backlogs/all");
    const first = await screen.findByRole("button", { name: /^Write the manual/ });
    const titles = Array.from(document.querySelectorAll(".issue-row .issue-title")).map((one) => one.textContent);
    expect(titles).toEqual(["Write the manual", "Import the boards", "Write the loader"]);
    const row = first.closest(".row") as HTMLElement;
    expect(within(row).getAllByRole("button")).toHaveLength(1);
    expect(row.querySelector(".issue-title")?.textContent).toBe("Write the manual");
    expect(Array.from(row.querySelectorAll(".chip")).map((one) => one.textContent)).toEqual(expect.arrayContaining(["Ready", "mwanachama-docs", "Docs"]));
    expect(screen.queryByText(/P[1-4]|critical|priority/i)).toBeNull();
  });

  it("2. the back arrow returns to Backlogs", async () => {
    inFarmers("/backlogs/all");
    await screen.findByRole("button", { name: /^Write the manual/ });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs`);
    expect(await screen.findByText("All issues")).toBeInTheDocument();
  });

  it("2. Home returns to the home screen", async () => {
    inFarmers("/backlogs/all");
    await screen.findByRole("button", { name: /^Write the manual/ });
    await userEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: /Home/ }));
    expect(where()).toBe(`/a/${farmers.id}/home`);
  });

  it("3. tapping a tag on an issue's page opens the list narrowed to it, with the tag as a chip with a cross", async () => {
    inFarmers("/backlogs/all");
    await userEvent.click(await screen.findByRole("button", { name: /^Write the manual/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Docs" }));
    expect(await screen.findByRole("button", { name: "Docs ✕" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Write the loader/ })).toBeNull();
    expect(where()).toContain("tag=Docs");
  });

  it("3. tags chosen together narrow the list and clearing a chip widens it", async () => {
    inFarmers("/backlogs/all?tag=Docs&tag=Blocked");
    expect(await screen.findByRole("button", { name: /^Import the boards/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Write the manual/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Blocked ✕" }));
    expect(await screen.findByRole("button", { name: /^Write the manual/ })).toBeInTheDocument();
  });

  it("3. tags no issue has all of show one line saying so", async () => {
    inFarmers("/backlogs/all?tag=Software&tag=Blocked");
    expect(await screen.findByText("No issues have all of those tags.")).toBeInTheDocument();
  });

  it("4. an issue opens with its description and a button for each issue it waits on", async () => {
    inFarmers("/backlogs/issue/t1");
    expect(await screen.findByText("Read every board.")).toBeInTheDocument();
    const waits = await screen.findAllByRole("button", { name: /Write the (manual|loader)/ });
    expect(waits).toHaveLength(2);
  });

  it("4. an issue that waits on nothing has no waits-on buttons", async () => {
    inFarmers("/backlogs/issue/t2");
    await screen.findByText("Write the manual");
    expect(screen.queryByText("Waits on")).toBeNull();
  });

  it("5. a waits-on button opens the issue it names and its own waits-on buttons", async () => {
    inFarmers("/backlogs/issue/t1");
    await userEvent.click(await screen.findByRole("button", { name: /Write the loader/ }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/issue/t3`);
    expect(await screen.findByText("The script.")).toBeInTheDocument();
  });

  it.todo("1. the chat's reply to 'show all issues' is a card and not a jump (the Triager's wording, not an app screen)");

  it.todo("3. 'show Docs and Blocked' answers with a card that names its filters and 'No issues are both Docs and Blocked.' when none match (Triager reply)");

  it.todo("4. the numbers in 'Open 2' refer to the list as last shown, and 'Open 99' answers 'The list has 83 issues.' (Triager reply)");

  it.todo("6. 'Move the import to Doing' answers a Which one? card with a button for each match (Triager reply)");
});
