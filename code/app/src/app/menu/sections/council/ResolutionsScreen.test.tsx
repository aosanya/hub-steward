import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { councilTools } from "./councilData";
import { councilPaths } from "./paths";
import { ResolutionsScreen, resolutionsTitle } from "./ResolutionsScreen";

const origin = { path: "/a/town/menu/council", title: "Decisions" };

const meetings: Record<string, unknown> = {
  m1: { id: "m1", name: "Spring Budget Meeting", date: "2026-03-10", place: "Town Hall", committee: "g1" },
};

const adopted = { id: "r1", meeting_id: "m1", title: "Approve the spring budget", date: "2026-03-10", outcome: "adopted" };
const rejected = { id: "r2", meeting_id: "", title: "Close the old depot", date: "2026-04-02", outcome: "rejected" };
const deferred = { id: "r3", meeting_id: "m9", title: "Repaint the bridge", date: "2026-05-20", outcome: "deferred" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";
let resolutions: unknown[] = [adopted, rejected, deferred];

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answer = (name: string, args: unknown) => {
  if (name === councilTools.resolutionList) return Promise.resolve({ items: resolutions });
  if (name === councilTools.resolutionRead) {
    const found = resolutions.find((item) => (item as { id: string }).id === (args as { resolutionID: string }).resolutionID);
    return found ? Promise.resolve(found) : Promise.reject(new Error("not found"));
  }
  if (name === councilTools.meetingRead) {
    const found = meetings[(args as { meetingID: string }).meetingID];
    return found ? Promise.resolve(found) : Promise.reject(new Error("not found"));
  }
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  resolutions = [adopted, rejected, deferred];
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const showResolutions = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: councilPaths.resolutions.path(), state: { from: origin } }]}>
      <Routes>
        <Route path={councilPaths.resolutions.pattern} element={<ResolutionsScreen />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

const metaOf = (row: HTMLElement) => Array.from(row.querySelectorAll(".meta")).map((line) => line.textContent);

describe("the Resolutions screen", () => {
  it("is titled Resolutions", () => {
    expect(resolutionsTitle).toBe("Resolutions");
  });

  it("lists each resolution by its title with its date and outcome", async () => {
    showResolutions();

    await screen.findByText("Approve the spring budget", { selector: ".ttl" });
    expect(screen.getByRole("heading", { name: "Resolutions" })).toBeInTheDocument();
    expect(metaOf(rowOf("Approve the spring budget"))).toEqual(["2026-03-10 · Adopted"]);
    expect(metaOf(rowOf("Close the old depot"))).toEqual(["2026-04-02 · Rejected"]);
    expect(metaOf(rowOf("Repaint the bridge"))).toEqual(["2026-05-20 · Deferred"]);
    expect(callsTo(councilTools.resolutionList)).toHaveLength(1);
  });

  it("opens the resolution beside the list with title, date, outcome and the meeting name", async () => {
    showResolutions();
    await userEvent.click(await screen.findByRole("button", { name: /Approve the spring budget/ }));

    await waitFor(() => expect(pane().textContent).toContain("Spring Budget Meeting"));
    expect(pane().textContent).toContain("Title");
    expect(pane().textContent).toContain("Approve the spring budget");
    expect(pane().textContent).toContain("Date");
    expect(pane().textContent).toContain("2026-03-10");
    expect(pane().textContent).toContain("Outcome");
    expect(pane().textContent).toContain("Adopted");
    expect(callsTo(councilTools.resolutionRead).map(([, , args]) => args)).toEqual([{ resolutionID: "r1" }]);
    expect(callsTo(councilTools.meetingRead).map(([, , args]) => args)).toEqual([{ meetingID: "m1" }]);
    expect(screen.getByRole("button", { name: /Approve the spring budget/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves the meeting out when the resolution has no meeting", async () => {
    showResolutions();
    await userEvent.click(await screen.findByRole("button", { name: /Close the old depot/ }));

    await waitFor(() => expect(pane().textContent).toContain("Rejected"));
    expect(pane().textContent).not.toContain("Meeting");
    expect(callsTo(councilTools.meetingRead)).toHaveLength(0);
  });

  it("leaves the meeting out when the meeting cannot be read", async () => {
    showResolutions();
    await userEvent.click(await screen.findByRole("button", { name: /Repaint the bridge/ }));

    await waitFor(() => expect(pane().textContent).toContain("Deferred"));
    expect(pane().textContent).not.toContain("Meeting");
    expect(callsTo(councilTools.meetingRead)).toHaveLength(1);
  });

  it("names Resolutions on the Back button of an opened resolution and returns to the list", async () => {
    showResolutions();
    await userEvent.click(await screen.findByRole("button", { name: /Approve the spring budget/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "‹ Resolutions" }));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Close the old depot")).toBeInTheDocument();
  });

  it("names the screen the person came from on the Back button of the list, and goes there", async () => {
    showResolutions();
    await screen.findByText("Approve the spring budget");

    await userEvent.click(screen.getByRole("button", { name: "‹ Decisions" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so, with a Home button, when the hub lists no resolutions", async () => {
    resolutions = [];
    showResolutions();

    expect(await screen.findByText("No resolutions yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
  });
});
