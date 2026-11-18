import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AgendaMinutesScreen } from "./AgendaMinutesScreen";
import { CouncilEditScreen } from "./CouncilEditScreen";
import { councilTools } from "./councilData";
import { councilPaths } from "./paths";

const meetings = [
  { id: "m1", name: "Spring Budget Meeting", date: "2026-03-04" },
  { id: "m2", name: "Summer Planning Meeting", date: "2026-06-10" },
];

const freshAgendas = (): Record<string, unknown> => ({
  m1: { meeting_id: "m1", items: ["Opening and apologies", "Budget review", "Any other business"] },
});

const freshMinutes = (): Record<string, unknown> => ({
  m1: { meeting_id: "m1", text: "The budget was reviewed and approved." },
});

let agendas = freshAgendas();
let minutes = freshMinutes();

const origin = { path: "/a/town/menu/council", title: "Decisions" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";
let listed: unknown[] = meetings;
let permissions: string[] = [];

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answer = (name: string, args: unknown) => {
  const id = (args as { meetingID?: string } | undefined)?.meetingID ?? "";
  if (name === "agency_get_my_roles") return Promise.resolve({ permissions });
  if (name === councilTools.agendaSet) {
    const set = args as { meetingID: string; items: string[] };
    agendas[set.meetingID] = { meeting_id: set.meetingID, items: set.items };
    return Promise.resolve(agendas[set.meetingID]);
  }
  if (name === councilTools.minutesSet) {
    const set = args as { meetingID: string; text: string };
    minutes[set.meetingID] = { meeting_id: set.meetingID, text: set.text };
    return Promise.resolve(minutes[set.meetingID]);
  }
  if (name === councilTools.meetingList) return Promise.resolve({ items: listed });
  if (name === councilTools.meetingRead) return Promise.resolve({ item: (listed as { id: string }[]).find((meeting) => meeting.id === id) });
  if (name === councilTools.agendaRead) return id in agendas ? Promise.resolve(agendas[id]) : Promise.reject(new Error("not found"));
  if (name === councilTools.minutesRead) return id in minutes ? Promise.resolve(minutes[id]) : Promise.reject(new Error("not found"));
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  listed = meetings;
  permissions = [];
  agendas = freshAgendas();
  minutes = freshMinutes();
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
        <Route path={councilPaths.edit.pattern} element={<CouncilEditScreen />} />
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

  describe("editing the papers of a meeting", () => {
    const openMeeting = async (name: RegExp) => {
      showAgendas();
      await userEvent.click(await screen.findByRole("button", { name }));
      await screen.findByRole("region", { name: "Minutes" });
    };

    it("lets a council.manage caller edit the minutes and shows the new text", async () => {
      permissions = ["council.view", "council.manage"];
      await openMeeting(/Spring Budget Meeting/);

      await userEvent.click(await within(screen.getByRole("region", { name: "Minutes" })).findByRole("button", { name: "Edit minutes" }));
      const field = screen.getByLabelText("Minutes text");
      await userEvent.clear(field);
      await userEvent.type(field, "The budget was approved with one change.");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(pane().textContent).toContain("The budget was approved with one change."));
      expect(callsTo(councilTools.minutesSet).map(([, , args]) => args)).toEqual([{ meetingID: "m1", text: "The budget was approved with one change." }]);
      expect(pane().textContent).not.toContain("The budget was reviewed and approved.");
    });

    it("lets a council.manage caller edit the agenda one item per line and shows the lines in order", async () => {
      permissions = ["council.manage"];
      await openMeeting(/Spring Budget Meeting/);

      await userEvent.click(await within(screen.getByRole("region", { name: "Agenda" })).findByRole("button", { name: "Edit agenda" }));
      const field = screen.getByLabelText("Agenda items, one per line");
      expect(field).toHaveValue("Opening and apologies\nBudget review\nAny other business");
      await userEvent.clear(field);
      await userEvent.type(field, "Welcome{Enter}Road repairs{Enter}{Enter}Close");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(within(screen.getByRole("region", { name: "Agenda" })).getByText("Close")).toBeInTheDocument());
      expect(callsTo(councilTools.agendaSet).map(([, , args]) => args)).toEqual([{ meetingID: "m1", items: ["Welcome", "Road repairs", "Close"] }]);
      const lines = Array.from(screen.getByRole("region", { name: "Agenda" }).querySelectorAll(".ttl")).map((line) => line.textContent);
      expect(lines).toEqual(["Welcome", "Road repairs", "Close"]);
    });

    it("lets a council.manage caller write the first agenda of a meeting that has none", async () => {
      permissions = ["council.manage"];
      await openMeeting(/Summer Planning Meeting/);

      await userEvent.click(await within(screen.getByRole("region", { name: "Agenda" })).findByRole("button", { name: "Edit agenda" }));
      await userEvent.type(screen.getByLabelText("Agenda items, one per line"), "Welcome");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await within(screen.getByRole("region", { name: "Agenda" })).findByText("Welcome")).toBeInTheDocument();
      expect(callsTo(councilTools.agendaSet).map(([, , args]) => args)).toEqual([{ meetingID: "m2", items: ["Welcome"] }]);
    });

    it("shows a council.view caller no Edit on either paper", async () => {
      permissions = ["council.view"];
      await openMeeting(/Spring Budget Meeting/);

      await waitFor(() => expect(callsTo("agency_get_my_roles").length).toBeGreaterThan(0));
      expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    });

    it("says why when the hub refuses the agenda and keeps the typed lines", async () => {
      permissions = ["council.manage"];
      await openMeeting(/Spring Budget Meeting/);
      called.mockImplementation(async (_agency, name, args) =>
        name === councilTools.agendaSet ? Promise.reject(new mcp.McpError("council_agenda_set: the meeting is closed")) : answer(name, args),
      );

      await userEvent.click(await within(screen.getByRole("region", { name: "Agenda" })).findByRole("button", { name: "Edit agenda" }));
      await userEvent.type(screen.getByLabelText("Agenda items, one per line"), "{Enter}Extra");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("the meeting is closed")).toBeInTheDocument();
      expect(screen.getByLabelText("Agenda items, one per line")).toHaveValue("Opening and apologies\nBudget review\nAny other business\nExtra");
    });
  });
});

describe("the Agendas & Minutes screen on a wide screen", () => {
  const setWide = (wide: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: wide,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  };

  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("keeps the meetings in the window's left pane and the agenda and minutes in its main pane", async () => {
    setWide(true);
    showAgendas();
    await userEvent.click(await screen.findByRole("button", { name: /Spring Budget Meeting/ }));

    const panes = document.querySelector(".wf-panes") as HTMLElement;
    expect(within(panes.querySelector(".wf-tree") as HTMLElement).getByRole("button", { name: /Summer Planning Meeting/ })).toBeInTheDocument();
    const content = panes.querySelector(".wf-main .wf-content") as HTMLElement;
    expect(await within(content).findByText("Budget review")).toBeInTheDocument();
    expect(within(content).getByText("The budget was reviewed and approved.")).toBeInTheDocument();
    expect(within(content).getByRole("region", { name: "Agenda" })).toBeInTheDocument();
    expect(within(content).getByRole("region", { name: "Minutes" })).toBeInTheDocument();
  });

  it("draws no window frame on a phone", async () => {
    setWide(false);
    showAgendas();
    await userEvent.click(await screen.findByRole("button", { name: /Spring Budget Meeting/ }));

    expect(document.querySelector(".wf")).toBeNull();
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
  });
});
