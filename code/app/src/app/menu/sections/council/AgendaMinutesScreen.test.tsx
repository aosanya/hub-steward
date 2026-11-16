import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AgendaMinutesScreen } from "./AgendaMinutesScreen";
import { councilTools } from "./councilData";
import { councilPaths } from "./paths";

const meetings = [
  { id: "m1", name: "Spring Budget Meeting", date: "2026-03-04" },
  { id: "m2", name: "Summer Planning Meeting", date: "2026-06-10" },
];

const agendas: Record<string, unknown> = {
  m1: { meeting_id: "m1", items: ["Opening and apologies", "Budget review", "Any other business"] },
};

const minutes: Record<string, unknown> = {
  m1: { meeting_id: "m1", text: "The budget was reviewed and approved." },
};

const origin = { path: "/a/town/menu/council", title: "Decisions" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";
let listed: unknown[] = meetings;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answer = (name: string, args: unknown) => {
  const id = (args as { meetingID?: string } | undefined)?.meetingID ?? "";
  if (name === councilTools.meetingList) return Promise.resolve({ items: listed });
  if (name === councilTools.agendaRead) return id in agendas ? Promise.resolve(agendas[id]) : Promise.reject(new Error("not found"));
  if (name === councilTools.minutesRead) return id in minutes ? Promise.resolve(minutes[id]) : Promise.reject(new Error("not found"));
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  listed = meetings;
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const showAgendas = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: councilPaths.agendas.path(), state: { from: origin } }]}>
      <Routes>
        <Route path={councilPaths.agendas.pattern} element={<AgendaMinutesScreen />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

describe("the Agendas & Minutes screen", () => {
  it("lists each meeting by name with its date", async () => {
    showAgendas();

    await screen.findByText("Spring Budget Meeting", { selector: ".ttl" });
    expect(rowOf("Spring Budget Meeting").textContent).toContain("2026-03-04");
    expect(rowOf("Summer Planning Meeting").textContent).toContain("2026-06-10");
    expect(screen.getByRole("heading", { name: "Agendas & Minutes" })).toBeInTheDocument();
    expect(callsTo(councilTools.meetingList)).toHaveLength(1);
  });

  it("shows the agenda items in order and the minutes text when a meeting is pressed", async () => {
    showAgendas();
    await userEvent.click(await screen.findByRole("button", { name: /Spring Budget Meeting/ }));

    await waitFor(() => expect(pane().textContent).toContain("The budget was reviewed and approved."));
    const lines = Array.from(pane().querySelectorAll(".ttl")).map((line) => line.textContent);
    expect(lines).toEqual(["Opening and apologies", "Budget review", "Any other business", "The budget was reviewed and approved."]);
    expect(callsTo(councilTools.agendaRead).map(([, , args]) => args)).toEqual([{ meetingID: "m1" }]);
    expect(callsTo(councilTools.minutesRead).map(([, , args]) => args)).toEqual([{ meetingID: "m1" }]);
    expect(screen.getByRole("button", { name: /Spring Budget Meeting/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("says there is no agenda and no minutes when the reads fail with not found", async () => {
    showAgendas();
    await userEvent.click(await screen.findByRole("button", { name: /Summer Planning Meeting/ }));

    expect(await screen.findByText("No agenda yet.")).toBeInTheDocument();
    expect(screen.getByText("No minutes yet.")).toBeInTheDocument();
  });

  it("names Agendas & Minutes on the Back button of an opened meeting and returns to the list", async () => {
    showAgendas();
    await userEvent.click(await screen.findByRole("button", { name: /Spring Budget Meeting/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "‹ Agendas & Minutes" }));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Summer Planning Meeting")).toBeInTheDocument();
  });

  it("names the screen the person came from on the Back button of the list, and goes there", async () => {
    showAgendas();
    await screen.findByText("Spring Budget Meeting");

    await userEvent.click(screen.getByRole("button", { name: "‹ Decisions" }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the hub lists no meetings", async () => {
    listed = [];
    showAgendas();

    expect(await screen.findByText(/No meetings/i)).toBeInTheDocument();
  });
});
