import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BylawsScreen } from "./BylawsScreen";
import { CommitteesScreen } from "./CommitteesScreen";
import { MeetingsScreen } from "./MeetingsScreens";
import { councilPaths } from "./paths";

const withWords = (words: Record<string, string>) => async (_agency: string, name: string) => {
  if (name === "agency_get_agency") return { name: "Zoldhalom" };
  if (name === "agency_list_mounts") return { modules: [{ module: "council", mounts: [{ name: "Council", words }] }] };
  if (name === "council_bylaw_list" || name === "council_meeting_list" || name === "actor_list_groups") return { items: [] };
  throw new Error(`${name}: unknown tool`);
};

const show = (path: string, pattern: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("zoldhalom"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the council screens in the agency's words", () => {
  it("title the Rules screen and its empty state with the agency's word and keep the Home button", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(withWords({ Rules: "Bylaws" }));
    show(councilPaths.bylaws.path(), councilPaths.bylaws.pattern, <BylawsScreen />);

    expect(await screen.findByText("No bylaws yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bylaws" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
  });

  it("title the Meetings and Committees screens and their empty states with the agency's words", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(withWords({ Meetings: "Sittings", Committees: "Boards" }));
    show(councilPaths.meetings.path(), councilPaths.meetings.pattern, <MeetingsScreen />);

    expect(await screen.findByText("No sittings yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sittings" })).toBeInTheDocument();
    cleanup();

    show(councilPaths.committees.path(), councilPaths.committees.pattern, <CommitteesScreen />);
    expect(await screen.findByText("No boards yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Boards" })).toBeInTheDocument();
  });

  it("show the generic words when the agency lists none", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(withWords({}));
    show(councilPaths.bylaws.path(), councilPaths.bylaws.pattern, <BylawsScreen />);

    expect(await screen.findByText("No bylaws yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
    cleanup();

    show(councilPaths.meetings.path(), councilPaths.meetings.pattern, <MeetingsScreen />);
    expect(await screen.findByText("No meetings yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meetings" })).toBeInTheDocument();
  });
});
