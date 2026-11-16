import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { agencyHomePath, forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { councilTools } from "./councilData";
import { MeetingsScreen, meetingsTitle } from "./MeetingsScreens";
import { councilPaths } from "./paths";

const origin = { path: "/a/town/menu/council", title: "Decisions" };

const meetings = [
  { id: "m1", name: "Spring Budget Meeting", date: "2026-03-12", place: "Town Hall", committee: "Finance Committee" },
  { id: "m2", name: "Park Planning Meeting", date: "2026-04-02", place: "Library Room" },
];

let called: MockInstance<typeof mcp.callTool>;
let landed = "";
let listing: () => Promise<unknown>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answer = (name: string, args: unknown) => {
  if (name === councilTools.meetingList) return listing();
  if (name === councilTools.meetingRead) {
    const found = meetings.find((meeting) => meeting.id === (args as { meetingID: string }).meetingID);
    return found ? Promise.resolve({ item: found }) : Promise.reject(new Error("not found"));
  }
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  listing = () => Promise.resolve({ items: meetings });
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const showMeetings = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: councilPaths.meetings.path(), state: { from: origin } }]}>
      <Routes>
        <Route path={councilPaths.meetings.pattern} element={<MeetingsScreen />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

describe("the Meetings screen", () => {
  it("is titled Meetings", () => {
    expect(meetingsTitle).toBe("Meetings");
  });

  it("lists a posted meeting by name with its date and place", async () => {
    showMeetings();

    await screen.findByText("Spring Budget Meeting", { selector: ".ttl" });
    expect(rowOf("Spring Budget Meeting").textContent).toContain("2026-03-12");
    expect(rowOf("Spring Budget Meeting").textContent).toContain("Town Hall");
    expect(rowOf("Park Planning Meeting").textContent).toContain("Library Room");
    expect(screen.getByRole("heading", { name: "Meetings" })).toBeInTheDocument();
    expect(callsTo(councilTools.meetingList)).toHaveLength(1);
  });

  it("shows the name, date, place and committee beside the list when a row is pressed", async () => {
    showMeetings();
    await userEvent.click(await screen.findByRole("button", { name: /Spring Budget Meeting/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Town Hall"));
    expect(pane().textContent).toContain("Spring Budget Meeting");
    expect(pane().textContent).toContain("2026-03-12");
    expect(pane().textContent).toContain("Finance Committee");
    expect(callsTo(councilTools.meetingRead).map(([, , args]) => args)).toEqual([{ meetingID: "m1" }]);
    expect(screen.getByRole("button", { name: /Spring Budget Meeting/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves out the committee when the meeting has none", async () => {
    showMeetings();
    await userEvent.click(await screen.findByRole("button", { name: /Park Planning Meeting/ }));

    await waitFor(() => expect(pane().textContent).toContain("Library Room"));
    expect(pane().textContent).not.toContain("Committee");
  });

  it("names Meetings on the Back button of an opened meeting and returns to the list", async () => {
    showMeetings();
    await userEvent.click(await screen.findByRole("button", { name: /Spring Budget Meeting/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "‹ Meetings" }));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Park Planning Meeting")).toBeInTheDocument();
  });

  it("then names the previous screen on the Back button of the list, and goes there", async () => {
    showMeetings();
    await screen.findByText("Spring Budget Meeting");

    await userEvent.click(screen.getByRole("button", { name: "‹ Decisions" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("draws the empty state with a Home button when no meetings are posted", async () => {
    listing = () => Promise.resolve({ items: [] });
    showMeetings();

    expect(await screen.findByText("No meetings yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    await waitFor(() => expect(landed).toBe(agencyHomePath("town")));
  });

  it("says so when the meetings could not be loaded", async () => {
    listing = () => Promise.reject(new Error("down"));
    showMeetings();

    expect(await screen.findByText("This list could not be loaded.")).toBeInTheDocument();
  });
});
