import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { councilTools } from "./councilData";
import { routes } from "./index";
import { councilPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let refusal = "";
let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const callsOf = (tool: string) => called.mock.calls.filter(([, name]) => name === tool);

const type = async (label: string, text: string) => userEvent.type(screen.getByLabelText(label), text);

beforeEach(() => {
  openAgency("town");
  permissions = ["council.manage", "group.manage"];
  refusal = "";
  landed = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === councilTools.meetingCreate || tool === councilTools.resolutionCreate || tool === councilTools.bylawCreate || tool === "actor_create_group") {
      if (refusal) throw new mcp.McpError(refusal);
      return { id: "new" };
    }
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const lists = [
  { name: "Meetings", path: () => councilPaths.meetings.path(), add: "Add meeting", permission: "council.manage" },
  { name: "Resolutions", path: () => councilPaths.resolutions.path(), add: "Add resolution", permission: "council.manage" },
  { name: "Bylaws", path: () => councilPaths.bylaws.path(), add: "Add bylaw", permission: "council.manage" },
  { name: "Committees", path: () => councilPaths.committees.path(), add: "Add committee", permission: "group.manage" },
];

describe.each(lists)("the $name list", ({ path, add, permission }) => {
  it(`shows ${add} to a holder of ${permission}`, async () => {
    show(path());

    expect(await screen.findByRole("button", { name: add })).toBeTruthy();
  });

  it(`shows no ${add} without ${permission}`, async () => {
    permissions = ["council.view"];
    show(path());

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    await screen.findByRole("heading", { name: /./ }).catch(() => null);

    expect(screen.queryByRole("button", { name: add })).toBeNull();
  });
});

describe("adding a meeting", () => {
  it("opens one Add screen and saves the name, the plain day, the place and the committee, then returns to the list", async () => {
    show(councilPaths.meetings.path());

    await userEvent.click(await screen.findByRole("button", { name: "Add meeting" }));
    await type("Name", "Autumn Meeting");
    await type("Date", "2026-12-03");
    await type("Place", "Town Hall");
    await type("Committee", "Finance");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsOf(councilTools.meetingCreate)).toEqual([["", councilTools.meetingCreate, { name: "Autumn Meeting", date: "2026-12-03", place: "Town Hall", committee: "Finance" }]]));
    await waitFor(() => expect(landed).toBe(councilPaths.meetings.path()));
  });

  it("keeps Save off until the name and the day are given", async () => {
    show(councilPaths.meetings.path());

    await userEvent.click(await screen.findByRole("button", { name: "Add meeting" }));

    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the hub's words when the save is refused and stays on the screen", async () => {
    refusal = "council_meeting_create: the meeting needs a name";
    show(councilPaths.meetings.path());

    await userEvent.click(await screen.findByRole("button", { name: "Add meeting" }));
    await type("Name", "Autumn Meeting");
    await type("Date", "2026-12-03");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the meeting needs a name")).toBeTruthy();
    expect(landed).toBe(councilPaths.meetingNew.path());
  });

  it("goes back to the list on Cancel without a call", async () => {
    show(councilPaths.meetings.path());

    await userEvent.click(await screen.findByRole("button", { name: "Add meeting" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(landed).toBe(councilPaths.meetings.path());
    expect(callsOf(councilTools.meetingCreate)).toEqual([]);
  });

  it("refuses a caller who does not hold council.manage", async () => {
    permissions = ["council.view"];
    show(councilPaths.meetingNew.path());

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});

describe("adding a resolution", () => {
  it("saves the title, the plain day and the outcome", async () => {
    show(councilPaths.resolutions.path());

    await userEvent.click(await screen.findByRole("button", { name: "Add resolution" }));
    await type("Title", "Adopt the 2027 budget");
    await type("Date", "2026-12-03");
    await type("Outcome", "adopted");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsOf(councilTools.resolutionCreate)).toEqual([["", councilTools.resolutionCreate, { title: "Adopt the 2027 budget", date: "2026-12-03", outcome: "adopted" }]]));
    await waitFor(() => expect(landed).toBe(councilPaths.resolutions.path()));
  });
});

describe("adding a bylaw", () => {
  it("saves the title, the year as a number and the text", async () => {
    show(councilPaths.bylaws.path());

    await userEvent.click(await screen.findByRole("button", { name: "Add bylaw" }));
    await type("Title", "Market stall fees");
    await type("Year", "2026");
    await type("Text", "A stall pays the daily fee.");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsOf(councilTools.bylawCreate)).toEqual([["", councilTools.bylawCreate, { title: "Market stall fees", year: 2026, text: "A stall pays the daily fee." }]]));
    await waitFor(() => expect(landed).toBe(councilPaths.bylaws.path()));
  });
});

describe("adding a committee", () => {
  it("creates a group of the Committee type with the name", async () => {
    show(councilPaths.committees.path());

    await userEvent.click(await screen.findByRole("button", { name: "Add committee" }));
    await type("Name", "Finance Committee");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsOf("actor_create_group")).toEqual([["", "actor_create_group", { name: "Finance Committee", node_type: "Committee" }]]));
    await waitFor(() => expect(landed).toBe(councilPaths.committees.path()));
  });
});
