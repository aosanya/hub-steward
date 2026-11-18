import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BylawsScreen } from "./BylawsScreen";
import { CouncilEditScreen } from "./CouncilEditScreen";
import { councilTools } from "./councilData";
import { MeetingsScreen } from "./MeetingsScreens";
import { councilPaths } from "./paths";
import { ResolutionsScreen } from "./ResolutionsScreen";

type Record = { [key: string]: unknown };

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let refusal: string;
let meetings: Record[];
let resolutions: Record[];
let bylaws: Record[];

const stored = (rows: Record[], key: string, given: Record) => rows.map((row) => (row.id === given[key] ? { ...row, ...given } : row));

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === councilTools.meetingList) return { items: meetings };
  if (name === councilTools.meetingRead) return { item: meetings.find((row) => row.id === given.meetingID) };
  if (name === councilTools.resolutionList) return { items: resolutions };
  if (name === councilTools.resolutionRead) return resolutions.find((row) => row.id === given.resolutionID);
  if (name === councilTools.bylawList) return { items: bylaws };
  if (name === councilTools.bylawRead) return { item: bylaws.find((row) => row.id === given.bylawID) };
  if (name === councilTools.meetingUpdate || name === councilTools.resolutionUpdate || name === councilTools.bylawUpdate) {
    if (refusal) throw new mcp.McpError(refusal);
    if (name === councilTools.meetingUpdate) meetings = stored(meetings, "meetingID", { ...given, id: given.meetingID });
    if (name === councilTools.resolutionUpdate) resolutions = stored(resolutions, "resolutionID", { ...given, id: given.resolutionID });
    if (name === councilTools.bylawUpdate) bylaws = stored(bylaws, "bylawID", { ...given, id: given.bylawID });
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["council.manage"];
  refusal = "";
  meetings = [{ id: "m1", name: "Spring Budget Meeting", date: "2026-03-12", place: "Town Hall", committee: "Finance Committee" }];
  resolutions = [{ id: "r1", meeting_id: "", title: "Approve the spring budget", date: "2026-03-12", outcome: "adopted" }];
  bylaws = [{ id: "b1", title: "Market stall fees", year: 2024, text: "A stall pays the daily fee." }];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = async (path: string, pattern: string, element: JSX.Element, row: RegExp) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
        <Route path={councilPaths.edit.pattern} element={<CouncilEditScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: row }));
};

const showMeeting = () => show(councilPaths.meetings.path(), councilPaths.meetings.pattern, <MeetingsScreen />, /Spring Budget Meeting/);

const showResolution = () => show(councilPaths.resolutions.path(), councilPaths.resolutions.pattern, <ResolutionsScreen />, /Approve the spring budget/);

const showBylaw = () => show(councilPaths.bylaws.path(), councilPaths.bylaws.pattern, <BylawsScreen />, /Market stall fees/);

const replace = async (label: string, text: string) => {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, text);
};

describe("editing a meeting from its detail", () => {
  it("sends the meeting id and the whole record with the new place, and the list and pane show it", async () => {
    await showMeeting();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await replace("Place", "Council Chamber");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", councilTools.meetingUpdate, { meetingID: "m1", name: "Spring Budget Meeting", date: "2026-03-12", place: "Council Chamber", committee: "Finance Committee" }),
    );
    expect((await screen.findAllByText(/Council Chamber/)).length).toBeGreaterThanOrEqual(2);
  });

  it("shows no Edit to a caller who holds council.view only", async () => {
    permissions = ["council.view"];
    await showMeeting();

    await screen.findByText("Finance Committee");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("shows the hub's words when the save is refused", async () => {
    refusal = "council_meeting_update: the meeting needs a name";
    await showMeeting();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await replace("Place", "Chamber");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the meeting needs a name")).toBeTruthy();
  });
});

describe("editing a resolution from its detail", () => {
  it("sends the outcome as the hub spells it and the list shows the new outcome", async () => {
    await showResolution();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await replace("Outcome", "deferred");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", councilTools.resolutionUpdate, { resolutionID: "r1", title: "Approve the spring budget", date: "2026-03-12", outcome: "deferred" }),
    );
    expect((await screen.findAllByText(/Deferred/)).length).toBeGreaterThanOrEqual(1);
  });

  it("shows the hub's words for an outcome it does not accept", async () => {
    refusal = "council_resolution_update: outcome must be one of adopted, rejected, deferred";
    await showResolution();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await replace("Outcome", "approved");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("outcome must be one of adopted, rejected, deferred")).toBeTruthy();
  });

  it("shows no Edit to a caller who holds council.view only", async () => {
    permissions = ["council.view"];
    await showResolution();

    await screen.findByText("Outcome");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});

describe("editing a bylaw from its detail", () => {
  it("sends the year as a number", async () => {
    await showBylaw();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await replace("Year", "2025");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", councilTools.bylawUpdate, { bylawID: "b1", title: "Market stall fees", year: 2025, text: "A stall pays the daily fee." }));
  });

  it("shows no Edit to a caller who holds council.view only", async () => {
    permissions = ["council.view"];
    await showBylaw();

    await screen.findByText("Year");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
