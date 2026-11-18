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
  { id: "e1", slug: "pothole-report", name: "Pothole report", summary: "Road surface damage", kind: "request", form_id: "f1" },
  { id: "e2", slug: "noise-complaint", name: "Noise complaint", summary: "Loud music at night", kind: "complaint", form_id: "f2" },
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
    forms_catalog_entry_read: (args) => ({ item: entries.find((entry) => entry.slug === args.slug) }),
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

const openIssue = async (name: RegExp) => {
  open(screens[0].at);
  await userEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes"));
};

describe("the Issues & Requests section's menu", () => {
  it("lists the screens under their names, in order, and leaves Overdue to its own screen", () => {
    expect(items.map((item) => item.title)).toEqual(["All Issues", "Assigned to Me", "Map View", "Service Types", "Wishes", "Send a Wish"]);
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

  it("opens an issue from its row inside the window, with its replies", async () => {
    answers.forms_catalog_reply_list = () => ({ items: [{ id: "r9", body: "Collected today.", created_at: "2026-03-07T10:00:00Z" }] });
    open(screens[1].at);
    await userEvent.click(await screen.findByRole("button", { name: /Fallen branch/ }));

    expect(await screen.findByText("Collected today.")).toBeInTheDocument();
    expect(landed).toBe(screens[1].at);
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i3" }));
  });

  it("has a Back button on the opened issue that reads Assigned to Me and closes the issue", async () => {
    open(screens[1].at);
    await userEvent.click(await screen.findByRole("button", { name: /Fallen branch/ }));
    await waitFor(() => expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes"));

    await userEvent.click(await screen.findByRole("button", { name: /Assigned to Me/ }));

    await waitFor(() => expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "no"));
    expect(landed).toBe(screens[1].at);
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

  it("opens the chosen type in the detail with its name, kind and form id", async () => {
    open(screens[3].at);
    await userEvent.click(await screen.findByRole("button", { name: /Noise complaint/ }));

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(await within(detail).findByText("complaint")).toBeInTheDocument();
    expect(within(detail).getByText("Noise complaint")).toBeInTheDocument();
    expect(within(detail).getByText("f2")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_read", { slug: "noise-complaint" });
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));

    afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

    it("keeps the list on the left, opens the chosen type in the right pane and draws no tab bar", async () => {
      open(screens[3].at);
      await userEvent.click(await screen.findByRole("button", { name: /Pothole report/ }));

      const main = document.querySelector(".wf-main") as HTMLElement;
      expect(await within(main).findByText("request")).toBeInTheDocument();
      expect(within(main).getByText("Pothole report")).toBeInTheDocument();
      expect(within(document.querySelector(".wf-tree") as HTMLElement).getByRole("button", { name: /Noise complaint/ })).toBeInTheDocument();
      expect(document.querySelector("nav.tabs")).toBeNull();
    });

    it("opens the first type in the right pane without a tap", async () => {
      open(screens[3].at);
      await screen.findByText("Pothole report");

      const main = document.querySelector(".wf-main") as HTMLElement;
      expect(await within(main).findByText("request")).toBeInTheDocument();
      expect(within(main).getByText("Pothole report")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Pothole report/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /Noise complaint/ })).toHaveAttribute("aria-pressed", "false");
    });
  });
});

describe("an issue", () => {
  it("opens from the row that was pressed in All Issues", async () => {
    await openIssue(/Blocked drain/);

    expect(landed).toBe(screens[0].at);
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i2" }));
  });

  it("shows its title and status from the row, and the replies sent on it", async () => {
    await openIssue(/Broken streetlight/);

    expect(await screen.findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(screen.getByText("The lamp has been replaced.")).toBeInTheDocument();
    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(within(detail).getByText("Broken streetlight")).toBeInTheDocument();
    expect(within(detail).getByText("open")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i1" }));
  });

  it("sends a reply on that issue from its Reply action", async () => {
    await openIssue(/Broken streetlight/);
    await screen.findByText("A crew is booked for Monday.");

    await userEvent.type(screen.getByRole("textbox"), "Thank you, noted.");
    await userEvent.click(screen.getByRole("button", { name: /^Reply/ }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_send", expect.objectContaining({ raisedItemID: "i1", body: "Thank you, noted." })),
    );
  });

  it("has a Back button that reads All Issues and closes the issue", async () => {
    await openIssue(/Broken streetlight/);
    await screen.findByText("A crew is booked for Monday.");

    await userEvent.click(screen.getByRole("button", { name: /All Issues/ }));

    await waitFor(() => expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "no"));
    expect(landed).toBe(screens[0].at);
  });

  it("says plainly when nobody has replied yet", async () => {
    answers.forms_catalog_reply_list = () => ({ items: [] });
    await openIssue(/Broken streetlight/);

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
    await openIssue(/Broken streetlight/);
    await screen.findByText("A crew is booked for Monday.");

    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
  });
});

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const chooseIssue = async (name: RegExp) => {
  open(screens[0].at);
  await userEvent.click(await screen.findByRole("button", { name }));
};

describe("All Issues on the menu window", () => {
  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  it("opens the chosen issue in the window, without leaving the All Issues path", async () => {
    setWide(false);
    await chooseIssue(/Broken streetlight/);

    expect(await screen.findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(landed).toBe(screens[0].at);
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
  });

  it("loads the chosen issue by its id, with its status and department", async () => {
    setWide(false);
    answers.forms_catalog_raised_item_list_nearby = () => ({ items: [{ id: "i1", title: "Broken streetlight", status: "open", department: "Roads" }] });
    await chooseIssue(/Broken streetlight/);

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(await within(detail).findByText("open")).toBeInTheDocument();
    expect(within(detail).getByText("Roads")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i1" }));
  });

  it("draws the issue beside the list in the Folders frame on a wide screen", async () => {
    setWide(true);
    await chooseIssue(/Broken streetlight/);

    const frame = document.querySelector(".wf") as HTMLElement;
    const list = frame.querySelector(".wf-tree") as HTMLElement;
    const main = frame.querySelector(".wf-main") as HTMLElement;
    expect(within(list).getByRole("button", { name: /Blocked drain/ })).toBeInTheDocument();
    expect(await within(main).findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /Broken streetlight/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("sends a reply from the window's Reply action and loads the thread again", async () => {
    setWide(true);
    await chooseIssue(/Broken streetlight/);
    await screen.findByText("A crew is booked for Monday.");
    const asked = () => called.mock.calls.filter(([, name]) => name === "forms_catalog_reply_list").length;
    const before = asked();

    await userEvent.type(screen.getByRole("textbox", { name: "Your reply" }), "Thank you, noted.");
    await userEvent.click(screen.getByRole("button", { name: /^Reply/ }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_send", expect.objectContaining({ raisedItemID: "i1", body: "Thank you, noted." })),
    );
    await waitFor(() => expect(asked()).toBeGreaterThan(before));
  });

  it("goes back from the opened issue to the list inside the window on a phone", async () => {
    setWide(false);
    await chooseIssue(/Broken streetlight/);
    await screen.findByText("A crew is booked for Monday.");

    await userEvent.click(screen.getByRole("button", { name: /All Issues/ }));

    await waitFor(() => expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "no"));
    expect(landed).toBe(screens[0].at);
  });
});

const chooseAssigned = async (name: RegExp) => {
  open(screens[1].at);
  await userEvent.click(await screen.findByRole("button", { name }));
};

describe("Assigned to Me on the menu window", () => {
  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  it("draws the assigned issue beside the list in the Folders frame on a wide screen", async () => {
    setWide(true);
    await chooseAssigned(/Fallen branch/);

    const frame = document.querySelector(".wf") as HTMLElement;
    const list = frame.querySelector(".wf-tree") as HTMLElement;
    const main = frame.querySelector(".wf-main") as HTMLElement;
    expect(within(list).getByRole("button", { name: /Loose paving stone/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /Fallen branch/ })).toHaveAttribute("aria-pressed", "true");
    expect(await within(main).findByText("Fallen branch")).toBeInTheDocument();
    expect(landed).toBe(screens[1].at);
  });

  it("opens the chosen issue in the window on a phone, with its status and replies", async () => {
    setWide(false);
    await chooseAssigned(/Fallen branch/);

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(await within(detail).findByText("open")).toBeInTheDocument();
    expect(await screen.findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
  });

  it("sends a reply on the assigned issue and loads the thread again", async () => {
    setWide(true);
    await chooseAssigned(/Fallen branch/);
    await screen.findByText("A crew is booked for Monday.");
    const asked = () => called.mock.calls.filter(([, name]) => name === "forms_catalog_reply_list").length;
    const before = asked();

    await userEvent.type(screen.getByRole("textbox", { name: "Your reply" }), "On my way.");
    await userEvent.click(screen.getByRole("button", { name: /^Reply/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_send", expect.objectContaining({ raisedItemID: "i3", body: "On my way." })));
    await waitFor(() => expect(asked()).toBeGreaterThan(before));
  });

  it.each([true, false])("says nothing is assigned inside the empty card when wide is %s", async (wide) => {
    setWide(wide);
    answers.forms_catalog_raised_item_list_mine = () => ({ items: [] });
    open(screens[1].at);

    expect(await screen.findByText("Nothing is assigned to you.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fallen branch/ })).toBeNull();
  });
});

const chooseOnMap = async (name: RegExp) => {
  open(screens[2].at);
  await userEvent.click(await screen.findByRole("button", { name }));
};

describe("Map View on the menu window", () => {
  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  it("opens the first row in the right pane on a wide screen without a tap", async () => {
    setWide(true);
    open(screens[2].at);
    await screen.findByRole("button", { name: /Broken streetlight/ });

    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    const main = document.querySelector(".wf-main") as HTMLElement;
    expect(await within(main).findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Broken streetlight/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Blocked drain/ })).toHaveAttribute("aria-pressed", "false");
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i1" }));
  });

  it("draws the chosen issue in the right pane beside the list on a wide screen", async () => {
    setWide(true);
    await chooseOnMap(/Broken streetlight/);

    const frame = document.querySelector(".wf") as HTMLElement;
    const list = frame.querySelector(".wf-tree") as HTMLElement;
    const main = frame.querySelector(".wf-main") as HTMLElement;
    expect(within(list).getByRole("button", { name: /Blocked drain/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /Broken streetlight/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(main).getByText("Broken streetlight")).toBeInTheDocument();
    expect(await within(main).findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_list", expect.objectContaining({ raisedItemID: "i1" }));
    expect(landed).toBe(screens[2].at);
  });

  it("opens the chosen issue with its status on a phone", async () => {
    setWide(false);
    await chooseOnMap(/Broken streetlight/);

    const detail = document.querySelector(".mw-detail") as HTMLElement;
    expect(await within(detail).findByText("open")).toBeInTheDocument();
    expect(await screen.findByText("A crew is booked for Monday.")).toBeInTheDocument();
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
    expect(landed).toBe(screens[2].at);
  });

  it("still shows the place of each issue in the list", async () => {
    setWide(true);
    open(screens[2].at);

    expect(await screen.findByText(/Elm Street/)).toBeInTheDocument();
    expect(screen.getByText(/Riverside/)).toBeInTheDocument();
  });
});
