import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import type { BacklogsClient } from "../../backlogs/api";
import type { RoomMessage, RoomsClient } from "../rooms/api";
import { Attachment } from "../rooms/cards";
import { BacklogSummariesLoader } from "./SummariesLoader";
import { backlogViewKind } from "./views";

const message = (targetId: string): RoomMessage => ({
  id: "m",
  author: "Triager",
  agent: true,
  mine: false,
  body: "",
  at: "2026-11-09T09:12:00Z",
  kind: backlogViewKind,
  targetId,
});

const client = (backlogs: BacklogsClient["backlogs"]): BacklogsClient => ({ backlogs, issues: async () => [], issue: async () => ({}) as never });

const show = (kinds: string[], backlogs: BacklogsClient["backlogs"], targetId: string) =>
  render(
    <MemoryRouter>
      <BacklogSummariesLoader kinds={kinds} client={client(backlogs)}>
        <Attachment message={message(targetId)} threadLabel="General" client={{} as RoomsClient} openAsk={() => {}} />
      </BacklogSummariesLoader>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

const loaded = async () => [{ id: "default", name: "Backlog", steps: ["To do", "Doing", "Done"], issues: 7 }];

describe("backlog summaries loader", () => {
  it("fills the cards with the counts of the hub", async () => {
    show([backlogViewKind], loaded, "all");
    expect(await screen.findByText("7 issues")).toBeInTheDocument();
  });

  it("gives a button for each backlog the hub returns", async () => {
    show([backlogViewKind], loaded, "backlogs");
    expect(await screen.findByRole("link", { name: /Backlog/ })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/default/board");
  });

  it("asks the hub for nothing when no message is a backlog view", () => {
    const backlogs = vi.fn(loaded);
    show(["text"], backlogs, "all");
    expect(backlogs).not.toHaveBeenCalled();
  });

  it("shows the cards without counts when the hub cannot be reached", async () => {
    show([backlogViewKind], async () => Promise.reject(new Error("down")), "all");
    expect(await screen.findByText("All issues")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ issues?$/)).toBeNull();
  });
});
