import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AllPeopleScreen, CommunicationsScreen, GroupsScreen, HouseholdsScreen, RegistrationsScreen } from "./PeopleScreens";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const people = [
  { id: "p1", display_name: "Amara Kole", status: "Active" },
  { id: "p2", display_name: "Dana Reyes", status: "Inactive" },
  { id: "p3", display_name: "Eli Marsh" },
  { id: "p4", display_name: "Nia Brandt" },
];

const blankPerson = { id: "p5", code: "AC-15", public_code: "M-F1E47F", display_name: "", first_name: "", last_name: "" };

const hungarianGroups = [
  { id: "h1", name: "Szabó háztartás, Óváros", node_type: "Háztartás" },
  { id: "h2", name: "Molnár háztartás, Óváros", node_type: "Háztartás" },
  { id: "h3", name: "Egyesület One", node_type: "Egyesület" },
];

const groups = [
  { id: "g1", name: "Household One", node_type: "Household" },
  { id: "g2", name: "Household Two", node_type: "Household" },
  { id: "g3", name: "Reading Circle", node_type: "Association" },
  { id: "g4", name: "Football Club", node_type: "Association" },
];

const populations: Record<string, number> = { g1: 12, g2: 31, g3: 45, g4: 58 };

const personGroups = [
  { actor_id: "p1", group_id: "g3", priority: "normal" },
  { actor_id: "p1", group_id: "g4", priority: "normal" },
];

const joinRequests = [
  { id: "r1", actor_id: "p3", actor_name: "", message: "May I join the garden?", state: "pending", requested_at: "2026-03-04T12:00:00Z" },
  { id: "r2", actor_id: "p4", actor_name: "", message: "", state: "pending", requested_at: "2026-03-09T12:00:00Z" },
];

const threads = [
  { id: "t1", label: "Garden Helpers", audience: "group", last_message_at: "2026-03-10T12:00:00Z" },
  { id: "t2", label: "Street Party Plans", audience: "group", last_message_at: "2026-03-12T12:00:00Z" },
];

const dayWords = (day: number) => new RegExp(`2026-03-${String(day).padStart(2, "0")}|${day} Mar|Mar ${day}\\b|${String(day).padStart(2, "0")}/03|03/${String(day).padStart(2, "0")}`);

const origin = { path: "/a/town/menu/residents", title: "People" };

const screens = [
  { title: "All People", at: "/a/town/menu/residents/people", pattern: "/a/:agencyId/menu/residents/people", Screen: AllPeopleScreen, tool: "actor_list_actors" },
  { title: "Households", at: "/a/town/menu/residents/households", pattern: "/a/:agencyId/menu/residents/households", Screen: HouseholdsScreen, tool: "actor_list_groups" },
  { title: "Registrations", at: "/a/town/menu/residents/registrations", pattern: "/a/:agencyId/menu/residents/registrations", Screen: RegistrationsScreen, tool: "actor_list_join_requests_for_group" },
  { title: "Groups & Associations", at: "/a/town/menu/residents/groups", pattern: "/a/:agencyId/menu/residents/groups", Screen: GroupsScreen, tool: "actor_list_groups" },
  { title: "Communications", at: "/a/town/menu/residents/communications", pattern: "/a/:agencyId/menu/residents/communications", Screen: CommunicationsScreen, tool: "comm_chat_thread_list" },
];

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
    actor_list_actors: () => ({ items: people }),
    actor_get_actor: (args) => people.find((person) => person.id === args.actor_id),
    actor_list_groups_for_actor: () => ({ items: personGroups }),
    actor_list_groups: () => ({ items: groups }),
    actor_get_group_population: (args) => ({ group_id: args.group_id, population: populations[String(args.group_id)] }),
    actor_list_join_requests_for_group: (args) => ({ items: args.group_id === "g1" ? joinRequests : [] }),
    comm_chat_thread_list: (args) => ({ items: args.structure_id === "g3" ? threads : [] }),
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

const toolsCalled = () => new Set(called.mock.calls.map(([, name]) => name).filter((name) => !String(name).startsWith("agency_")));

const open = (at: string, state: unknown = { from: origin }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: at, state }]}>
      <Routes>
        {screens.map(({ pattern, Screen }) => (
          <Route key={pattern} path={pattern} element={<Screen />} />
        ))}
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pathOf = (item: { path: unknown }) => (typeof item.path === "function" ? (item.path as () => string)() : String(item.path));

describe("the People section's menu", () => {
  it("lists the eight People screens under their names, in order", () => {
    expect(items.map((item) => item.title)).toEqual(["Search", "All People", "Households", "Registrations", "Groups & Associations", "Communications", "Businesses", "Informal traders"]);
  });

  it("gives each screen its own path inside the People section", () => {
    const paths = items.map(pathOf);

    paths.forEach((path) => expect(path).toMatch(/^\/a\/town\/menu\/residents\/[a-z-]+$/));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("exports the routes that serve those screens", () => {
    expect(routes).toBeTruthy();
  });
});

describe("All People", () => {
  it("draws a row for each person with their status", async () => {
    open(screens[0].at);

    expect(await screen.findByText("Amara Kole")).toBeInTheDocument();
    expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All People" })).toBeInTheDocument();
    expect(toolsCalled()).toEqual(new Set(["actor_list_actors"]));
  });

  it("opens the person beside the list on the row that was pressed, without leaving the screen", async () => {
    open(screens[0].at);

    await userEvent.click(await screen.findByRole("button", { name: /Dana Reyes/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p2" }));
    expect((await screen.findAllByText("Inactive")).length).toBe(2);
    expect(landed).toBe(screens[0].at);
  });
});

describe("All People with no display name", () => {
  it("draws the person's code and first and last name instead of a blank row", async () => {
    answers.actor_list_actors = () => ({
      items: [...people, blankPerson, { id: "p6", code: "AC-16", display_name: "", first_name: "Réka", last_name: "Tóth" }],
    });
    open(screens[0].at);

    expect(await screen.findByText("AC-15")).toBeInTheDocument();
    expect(screen.getByText("Réka Tóth")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Amara Kole|Dana Reyes|Eli Marsh|Nia Brandt|AC-15|Réka Tóth/ })).toHaveLength(6);
  });

  it("draws the code on the person's own card", async () => {
    answers.actor_list_actors = () => ({ items: [blankPerson] });
    answers.actor_get_actor = () => blankPerson;
    open(screens[0].at);

    await userEvent.click(await screen.findByRole("button", { name: /AC-15/ }));

    await waitFor(() => expect(screen.getAllByText("AC-15")).toHaveLength(2));
  });
});

describe("a person", () => {
  const openAmara = async () => {
    open(screens[0].at);
    await userEvent.click(await screen.findByRole("button", { name: /Amara Kole/ }));
  };

  it("shows their name and status, and the groups they belong to", async () => {
    await openAmara();

    expect(await screen.findByText("Reading Circle")).toBeInTheDocument();
    expect(screen.getByText("Football Club")).toBeInTheDocument();
    expect(screen.getAllByText("Amara Kole")).toHaveLength(2);
    expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p1" });
    expect(called).toHaveBeenCalledWith("", "actor_list_groups_for_actor", { actor_id: "p1" });
    expect(toolsCalled()).toEqual(new Set(["actor_list_actors", "actor_get_actor", "actor_list_groups_for_actor", "actor_list_groups"]));
  });

  it("says plainly when the person belongs to no group", async () => {
    answers.actor_list_groups_for_actor = () => ({ items: [] });
    await openAmara();

    expect(await screen.findByText("Not in any group yet.")).toBeInTheDocument();
    expect(screen.queryByText("Reading Circle")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Households", () => {
  it("lists the groups whose level is named in the hub's own language", async () => {
    answers.actor_list_groups = () => ({ items: hungarianGroups });
    open(screens[1].at);

    expect(await screen.findByText("Szabó háztartás, Óváros")).toBeInTheDocument();
    expect(screen.getByText("Molnár háztartás, Óváros")).toBeInTheDocument();
    expect(screen.queryByText("Egyesület One")).toBeNull();
  });

  it("draws a row for each household group with its member count, and leaves other groups out", async () => {
    open(screens[1].at);

    expect(await screen.findByText("Household One")).toBeInTheDocument();
    expect(screen.getByText("Household Two")).toBeInTheDocument();
    expect(await screen.findByText(/\b12\b/)).toBeInTheDocument();
    expect(screen.getByText(/\b31\b/)).toBeInTheDocument();
    expect(screen.queryByText("Reading Circle")).toBeNull();
    expect(screen.queryByText("Football Club")).toBeNull();
    expect(called).toHaveBeenCalledWith("", "actor_get_group_population", { group_id: "g1" });
    expect(called).toHaveBeenCalledWith("", "actor_get_group_population", { group_id: "g2" });
    expect(toolsCalled()).toEqual(new Set(["actor_list_groups", "actor_get_group_population"]));
  });

  it("shows no address and no head of household", async () => {
    open(screens[1].at);
    await screen.findByText("Household One");

    expect(screen.queryByText(/address/i)).toBeNull();
    expect(screen.queryByText(/head of/i)).toBeNull();
  });
});

describe("Registrations", () => {
  it("draws a row for each request with the name and the day it was made", async () => {
    open(screens[2].at);

    expect(await screen.findByText("Eli Marsh")).toBeInTheDocument();
    expect(screen.getByText("Nia Brandt")).toBeInTheDocument();
    expect(screen.getByText(dayWords(4))).toBeInTheDocument();
    expect(screen.getByText(dayWords(9))).toBeInTheDocument();
    groups.forEach((group) => expect(called).toHaveBeenCalledWith("", "actor_list_join_requests_for_group", { group_id: group.id }));
    expect(toolsCalled()).toEqual(new Set(["actor_list_groups", "actor_list_join_requests_for_group", "actor_list_actors"]));
  });

  it("reads the requester's name from the person the request names when actor_name is empty", async () => {
    answers.actor_list_actors = () => ({ items: [...people, blankPerson] });
    answers.actor_list_join_requests_for_group = (args) => ({
      items: args.group_id === "g1" ? [{ id: "r9", actor_id: "p5", actor_name: "", message: "Hello", state: "pending", requested_at: "2026-03-04T12:00:00Z" }] : [],
    });
    open(screens[2].at);

    expect(await screen.findByText("AC-15")).toBeInTheDocument();
  });

  it("prefers actor_name when the request carries one", async () => {
    answers.actor_list_join_requests_for_group = (args) => ({
      items: args.group_id === "g1" ? [{ id: "r9", actor_id: "p3", actor_name: "Elizabeth Marsh", message: "", state: "pending", requested_at: "2026-03-04T12:00:00Z" }] : [],
    });
    open(screens[2].at);

    expect(await screen.findByText("Elizabeth Marsh")).toBeInTheDocument();
  });
});

describe("Groups & Associations", () => {
  it("draws a row for each group with its member count", async () => {
    answers.actor_list_groups = () => ({ items: groups.filter((group) => group.node_type === "Association") });
    open(screens[3].at);

    expect(await screen.findByText("Reading Circle")).toBeInTheDocument();
    expect(screen.getByText("Football Club")).toBeInTheDocument();
    expect(await screen.findByText(/\b45\b/)).toBeInTheDocument();
    expect(screen.getByText(/\b58\b/)).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "actor_get_group_population", { group_id: "g3" });
    expect(called).toHaveBeenCalledWith("", "actor_get_group_population", { group_id: "g4" });
    expect(toolsCalled()).toEqual(new Set(["actor_list_groups", "actor_get_group_population"]));
  });
});

describe("Communications", () => {
  it("draws a row for each thread with the time of its last message", async () => {
    open(screens[4].at);

    expect(await screen.findByText("Garden Helpers")).toBeInTheDocument();
    expect(screen.getByText("Street Party Plans")).toBeInTheDocument();
    expect(screen.getByText(dayWords(10))).toBeInTheDocument();
    expect(screen.getByText(dayWords(12))).toBeInTheDocument();
    groups.forEach((group) => expect(called).toHaveBeenCalledWith("", "comm_chat_thread_list", { structure_id: group.id }));
    expect(toolsCalled()).toEqual(new Set(["actor_list_groups", "comm_chat_thread_list"]));
  });
});

describe.each(screens)("$title as a screen of the People section", ({ title, at, tool }) => {
  it("has a Back button that reads People and goes there", async () => {
    open(at);
    await waitFor(() => expect(called).toHaveBeenCalled());

    await userEvent.click(await screen.findByRole("button", { name: /People/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("reads another origin's name when the person came from somewhere else", async () => {
    open(at, { from: { path: "/a/town/menu/services", title: "Services & Permits" } });
    await waitFor(() => expect(called).toHaveBeenCalled());

    expect(await screen.findByRole("button", { name: /Services & Permits/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^People/ })).toBeNull();
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

describe("Households with no household among the groups", () => {
  it("shows the empty card, not a list of other groups", async () => {
    answers.actor_list_groups = () => ({ items: groups.filter((group) => group.node_type === "Association") });
    open(screens[1].at);

    await waitFor(() => expect(document.querySelector(".card button")).not.toBeNull());
    expect(screen.queryByText("Reading Circle")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

describe.each(screens.map(({ title, at }) => ({ title, at })))("$title bottom tab bar", ({ at }) => {
  it("draws the main tab bar like every other section screen", async () => {
    open(at);
    await waitFor(() => expect(called).toHaveBeenCalled());

    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
  });
});

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

describe("All People on the menu window", () => {
  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  it("draws the Folders frame at wide size with the list beside the chosen person and their groups", async () => {
    setWide(true);
    open(screens[0].at);

    await userEvent.click(await screen.findByRole("button", { name: /Amara Kole/ }));

    const frame = document.querySelector(".wf") as HTMLElement;
    const tree = frame.querySelector(".wf-panes .wf-tree") as HTMLElement;
    const content = frame.querySelector(".wf-main .wf-content") as HTMLElement;
    expect(within(tree).getByRole("button", { name: /Dana Reyes/ })).toBeInTheDocument();
    expect(await within(content).findByText("Amara Kole")).toBeInTheDocument();
    expect(await within(content).findByText("Reading Circle")).toBeInTheDocument();
    expect(landed).toBe(screens[0].at);
  });

  it("shows one pane at a time on a phone and returns to the list from the person", async () => {
    setWide(false);
    open(screens[0].at);

    await userEvent.click(await screen.findByRole("button", { name: /Amara Kole/ }));

    expect(document.querySelector(".wf")).toBeNull();
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
    expect(await screen.findByText("Reading Circle")).toBeInTheDocument();
    expect(landed).toBe(screens[0].at);
    await userEvent.click(screen.getByRole("button", { name: /All People/ }));
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "no");
  });
});

const groupWindows = [
  { title: "Households", screenIndex: 1, chosen: "Household One", other: "Household Two", count: "12 members", id: "g1" },
  { title: "Groups & Associations", screenIndex: 3, chosen: "Reading Circle", other: "Football Club", count: "45 members", id: "g3" },
];

describe.each(groupWindows)("$title on the menu window", ({ title, screenIndex, chosen, other, count, id }) => {
  beforeEach(() => {
    answers.actor_get_group = (args) => groups.find((group) => group.id === args.group_id);
  });

  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  it("draws the Folders frame at wide size with the list beside the chosen group and its member count", async () => {
    setWide(true);
    open(screens[screenIndex].at);

    await userEvent.click(await screen.findByRole("button", { name: new RegExp(chosen) }));

    const frame = document.querySelector(".wf") as HTMLElement;
    const tree = frame.querySelector(".wf-panes .wf-tree") as HTMLElement;
    const content = frame.querySelector(".wf-main .wf-content") as HTMLElement;
    expect(within(tree).getByRole("button", { name: new RegExp(other) })).toBeInTheDocument();
    expect(await within(content).findByText(chosen)).toBeInTheDocument();
    expect(await within(content).findByText(count)).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "actor_get_group", { group_id: id });
    expect(landed).toBe(screens[screenIndex].at);
  });

  it("shows one pane at a time on a phone and returns to the list from the group", async () => {
    setWide(false);
    open(screens[screenIndex].at);

    await userEvent.click(await screen.findByRole("button", { name: new RegExp(chosen) }));

    expect(document.querySelector(".wf")).toBeNull();
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "yes");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_get_group", { group_id: id }));
    expect(landed).toBe(screens[screenIndex].at);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(title) }));
    expect(document.querySelector(".mw")).toHaveAttribute("data-chosen", "no");
  });
});
