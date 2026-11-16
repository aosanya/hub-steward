import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AllIssuesScreen, AssignedToMeScreen, IssueScreen, MapViewScreen, ServiceTypesScreen, items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const nearby = [
  { id: "i1", title: "Broken streetlight", status: "open", street: "Elm Street", area: "North Ward" },
  { id: "i2", title: "Blocked drain", status: "received", area: "Riverside" },
];

const mine = [
  { id: "i3", title: "Fallen branch", status: "open", topic: "trees" },
  { id: "i4", title: "Loose paving stone", status: "closed", topic: "streetlights" },
];

const entries = [
  { id: "e1", name: "Pothole report", summary: "Road surface damage" },
  { id: "e2", name: "Noise complaint", summary: "Loud music at night" },
];

const replies = [
  { id: "r1", raised_item_id: "i1", body: "A crew is booked for Monday.", replied_by: "s1", created_at: "2026-03-04T12:00:00Z" },
  { id: "r2", raised_item_id: "i1", body: "The lamp has been replaced.", replied_by: "s1", created_at: "2026-03-06T12:00:00Z" },
];

const origin = { path: "/a/town/menu/issues", title: "Issues & Requests" };

const screens = [
  { title: "All Issues", at: "/a/town/menu/issues/all", pattern: "/a/:agencyId/menu/issues/all", Screen: AllIssuesScreen, tool: "forms_catalog_raised_item_list_nearby" },
  { title: "Assigned to Me", at: "/a/town/menu/issues/assigned", pattern: "/a/:agencyId/menu/issues/assigned", Screen: AssignedToMeScreen, tool: "forms_catalog_raised_item_list_mine" },
  { title: "Map View", at: "/a/town/menu/issues/map", pattern: "/a/:agencyId/menu/issues/map", Screen: MapViewScreen, tool: "forms_catalog_raised_item_list_nearby" },
  { title: "Service Types", at: "/a/town/menu/issues/service-types", pattern: "/a/:agencyId/menu/issues/service-types", Screen: ServiceTypesScreen, tool: "forms_catalog_entry_list" },
];

const issuePattern = "/a/:agencyId/menu/issues/all/:id";

let landed = "";
let called: MockInstance<typeof mcp.callTool>;
let answers: Record<string, (args: Args) => unknown>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  answers = {
    forms_catalog_raised_item_list_nearby: () => ({ items: nearby }),
    forms_catalog_raised_item_list_mine: () => ({ items: mine }),
    forms_catalog_setting_read: () => ({ value: "streetlights, drains" }),
    forms_catalog_entry_list: () => ({ items: entries }),
    forms_catalog_reply_list: () => ({ items: replies }),
    forms_catalog_reply_send: (args) => ({ id: "r3", raised_item_id: args.raisedItemID, body: args.body }),
  };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const toolsCalled = () => new Set(called.mock.calls.map(([, name]) => name).filter((name) => !name.startsWith("agency_")));

const open = (at: string, state: unknown = { from: origin }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: at, state }]}>
      <Routes>
        {screens.map(({ pattern, Screen }) => (
          <Route key={pattern} path={pattern} element={<Screen />} />
        ))}
        <Route path={issuePattern} element={<IssueScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pathOf = (item: { path: unknown }) => (typeof item.path === "function" ? (item.path as () => string)() : String(item.path));

const issueAt = (id: string) => `/a/town/menu/issues/all/${id}`;

const openIssue = async (name: RegExp, id: string) => {
  open(screens[0].at);
  await userEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(landed).toBe(issueAt(id)));
};

describe("the Issues & Requests section's menu", () => {
  it("lists the four screens under their names, in order, and leaves Overdue to its own screen", () => {
    expect(items.map((item) => item.title)).toEqual(["All Issues", "Assigned to Me", "Map View", "Service Types"]);
  });

  it("gives each screen its own path inside the Issues & Requests section", () => {
    const paths = items.map(pathOf);

    paths.forEach((path) => expect(path).toMatch(/^\/a\/town\/menu\/issues\/[a-z-]+$/));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("exports the routes that serve those screens", () => {
    expect(routes).toBeTruthy();
  });
});

describe("All Issues", () => {
  it("draws a row for each issue with its title and status", async () => {
    open(screens[0].at);

    expect(await screen.findByText("Broken streetlight")).toBeInTheDocument();
    expect(screen.getByText("Blocked drain")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("received")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Issues" })).toBeInTheDocument();
    expect(toolsCalled()).toContain("forms_catalog_raised_item_list_nearby");
  });

  it("asks the nearby tool for each known topic, anywhere, with the arguments it requires", async () => {
    open(screens[0].at);
    await screen.findByText("Broken streetlight");

    const asked = called.mock.calls.filter(([, name]) => name === "forms_catalog_raised_item_list_nearby").map(([, , args]) => args as Args);
    expect(asked.map((args) => args.topic).sort()).toEqual(["drains", "streetlights", "trees"]);
    asked.forEach((args) => {
      expect(args.at).toEqual([0, 0]);
      expect(args.within).toBeGreaterThan(0);
    });
  });

  it("lists an issue once however many topics returned it", async () => {
    open(screens[0].at);
    await screen.findByText("Broken streetlight");

    expect(screen.getAllByText("Broken streetlight")).toHaveLength(1);
  });

  it("still lists the issues of the topics it knows when the topic setting cannot be read", async () => {
    answers.forms_catalog_setting_read = () => {
      throw new Error("no such setting");
    };
    open(screens[0].at);

    expect(await screen.findByText("Broken streetlight")).toBeInTheDocument();
  });
});

describe("Assigned to Me", () => {
  it("draws a row for each issue assigned to the person", async () => {
    open(screens[1].at);

    expect(await screen.findByText("Fallen branch")).toBeInTheDocument();
    expect(screen.getByText("Loose paving stone")).toBeInTheDocument();
    expect(screen.queryByText("Broken streetlight")).toBeNull();
    expect(toolsCalled()).toEqual(new Set(["forms_catalog_raised_item_list_mine"]));
  });

  it("opens an issue from its row, with its replies", async () => {
    answers.forms_catalog_reply_list = () => ({ items: [{ id: "r9", body: "Collected today.", created_at: "2026-03-07T10:00:00Z" }] });
    open(screens[1].at);
    await userEvent.click(await screen.findByRole("button", { name: /Fallen branch/ }));

    await waitFor(() => expect(landed).toBe(issueAt("i3")));
    expect(await screen.findByText("Collected today.")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i3" }));
  });

  it("has a Back button on the opened issue that reads Assigned to Me", async () => {
    open(screens[1].at);
    await userEvent.click(await screen.findByRole("button", { name: /Fallen branch/ }));
    await waitFor(() => expect(landed).toBe(issueAt("i3")));

    await userEvent.click(await screen.findByRole("button", { name: /Assigned to Me/ }));

    await waitFor(() => expect(landed).toBe(screens[1].at));
  });
});

describe("Map View", () => {
  it("draws a row for each issue with the place it was raised at", async () => {
    open(screens[2].at);

    expect(await screen.findByText("Broken streetlight")).toBeInTheDocument();
    expect(screen.getByText("Blocked drain")).toBeInTheDocument();
    expect(screen.getByText(/Elm Street/)).toBeInTheDocument();
    expect(screen.getByText(/Riverside/)).toBeInTheDocument();
    expect(toolsCalled()).toContain("forms_catalog_raised_item_list_nearby");
  });

  it("sends topic, at and within to the nearby tool", async () => {
    open(screens[2].at);
    await screen.findByText("Broken streetlight");

    expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_list_nearby", expect.objectContaining({ topic: "drains", at: [0, 0], within: expect.any(Number) }));
  });
});

describe("Service Types", () => {
  it("draws a row for each type with its name and short line", async () => {
    open(screens[3].at);

    expect(await screen.findByText("Pothole report")).toBeInTheDocument();
    expect(screen.getByText("Noise complaint")).toBeInTheDocument();
    expect(screen.getByText("Road surface damage")).toBeInTheDocument();
    expect(screen.getByText("Loud music at night")).toBeInTheDocument();
    expect(toolsCalled()).toEqual(new Set(["forms_catalog_entry_list"]));
  });
});

describe("an issue", () => {
  it("opens from the row that was pressed in All Issues", async () => {
    await openIssue(/Blocked drain/, "i2");

    expect(landed).toBe(issueAt("i2"));
  });

  it("shows its title and status from the row, and the replies sent on it", async () => {
    await openIssue(/Broken streetlight/, "i1");

    expect(await screen.findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(screen.getByText("The lamp has been replaced.")).toBeInTheDocument();
    expect(screen.getByText("Broken streetlight")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i1" }));
  });

  it("sends a reply on that issue from its Reply action", async () => {
    await openIssue(/Broken streetlight/, "i1");
    await screen.findByText("A crew is booked for Monday.");

    await userEvent.type(screen.getByRole("textbox"), "Thank you, noted.");
    await userEvent.click(screen.getByRole("button", { name: /^Reply/ }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_send", expect.objectContaining({ raisedItemID: "i1", body: "Thank you, noted." })),
    );
  });

  it("has a Back button that reads All Issues and goes there", async () => {
    await openIssue(/Broken streetlight/, "i1");
    await screen.findByText("A crew is booked for Monday.");

    await userEvent.click(screen.getByRole("button", { name: /All Issues/ }));

    await waitFor(() => expect(landed).toBe(screens[0].at));
  });

  it("says plainly when nobody has replied yet", async () => {
    answers.forms_catalog_reply_list = () => ({ items: [] });
    await openIssue(/Broken streetlight/, "i1");

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i1" })));
    expect(screen.queryByText("A crew is booked for Monday.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe.each(screens)("$title as a screen of the Issues & Requests section", ({ title, at, tool }) => {
  it("has a Back button that reads Issues & Requests and goes there", async () => {
    open(at);
    await waitFor(() => expect(called).toHaveBeenCalled());

    await userEvent.click(await screen.findByRole("button", { name: /Issues & Requests/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("reads another origin's name when the person came from somewhere else", async () => {
    open(at, { from: { path: "/a/town/menu/services", title: "Services & Permits" } });
    await waitFor(() => expect(called).toHaveBeenCalled());

    expect(await screen.findByRole("button", { name: /Services & Permits/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Issues & Requests/ })).toBeNull();
  });

  it("shows the empty state as a card with its act inside it when nothing came back", async () => {
    answers[tool] = () => ({ items: [] });
    open(at);

    await waitFor(() => expect(document.querySelector(".card button")).not.toBeNull());
    const card = (document.querySelector(".card button") as HTMLElement).closest(".card") as HTMLElement;
    expect(within(card).getAllByRole("button")).not.toHaveLength(0);
    expect(card.querySelector("p")?.textContent).not.toBe("");
    expect(card.querySelector("svg, img")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});

describe.each(screens)("$title bottom tab bar", ({ at }) => {
  it("draws the main tab bar like every other section screen", async () => {
    open(at);
    await waitFor(() => expect(called).toHaveBeenCalled());

    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
  });
});

describe("an issue's bottom tab bar", () => {
  it("draws the main tab bar like every other section screen", async () => {
    await openIssue(/Broken streetlight/, "i1");
    await screen.findByText("A crew is booked for Monday.");

    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
  });
});
