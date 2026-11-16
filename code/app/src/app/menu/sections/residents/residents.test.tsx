import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AllPeopleScreen, CommunicationsScreen, GroupsScreen, HouseholdsScreen, PersonScreen, RegistrationsScreen } from "./PeopleScreens";
import { items, routes } from "./index";

type Args = Record<string, unknown>;

const people = [
  { id: "p1", display_name: "Amara Kole", status: "Active" },
  { id: "p2", display_name: "Dana Reyes", status: "Inactive" },
];

const groups = [
  { id: "g1", name: "Household One", node_type: "Household" },
  { id: "g2", name: "Household Two", node_type: "Household" },
  { id: "g3", name: "Reading Circle", node_type: "Association" },
  { id: "g4", name: "Football Club", node_type: "Association" },
];

const populations: Record<string, number> = { g1: 12, g2: 31, g3: 45, g4: 58 };

const personGroups = [
  { actor_id: "p1", group_id: "g3", name: "Reading Circle" },
  { actor_id: "p1", group_id: "g4", name: "Football Club" },
];

const joinRequests = [
  { id: "r1", actor_id: "p3", name: "Eli Marsh", state: "pending", requested_at: "2026-03-04T12:00:00Z" },
  { id: "r2", actor_id: "p4", name: "Nia Brandt", state: "pending", requested_at: "2026-03-09T12:00:00Z" },
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

const personAt = (id: string) => `/a/town/menu/residents/people/${id}`;

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
    actor_list_join_requests_for_group: () => ({ items: joinRequests }),
    comm_chat_thread_list: () => ({ items: threads }),
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

const toolsCalled = () => new Set(called.mock.calls.map(([, name]) => name));

const open = (at: string, state: unknown = { from: origin }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: at, state }]}>
      <Routes>
        {screens.map(({ pattern, Screen }) => (
          <Route key={pattern} path={pattern} element={<Screen />} />
        ))}
        <Route path="/a/:agencyId/menu/residents/people/:id" element={<PersonScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const pathOf = (item: { path: unknown }) => (typeof item.path === "function" ? (item.path as () => string)() : String(item.path));

describe("the People section's menu", () => {
  it("lists the five People screens under their names, in order", () => {
    expect(items.map((item) => item.title)).toEqual(["All People", "Households", "Registrations", "Groups & Associations", "Communications"]);
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

  it("opens the person on the row that was pressed", async () => {
    open(screens[0].at);

    await userEvent.click(await screen.findByRole("button", { name: /Dana Reyes/ }));

    await waitFor(() => expect(landed).toBe(personAt("p2")));
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p2" });
  });
});

describe("a person", () => {
  it("shows their name and status, and the groups they belong to", async () => {
    open(personAt("p1"));

    expect(await screen.findByText("Amara Kole")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(await screen.findByText("Reading Circle")).toBeInTheDocument();
    expect(screen.getByText("Football Club")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p1" });
    expect(called).toHaveBeenCalledWith("", "actor_list_groups_for_actor", { actor_id: "p1" });
    expect(toolsCalled()).toEqual(new Set(["actor_get_actor", "actor_list_groups_for_actor"]));
  });

  it("has a Back button that reads All People when the person was opened from that list", async () => {
    open(screens[0].at);
    await userEvent.click(await screen.findByRole("button", { name: /Amara Kole/ }));
    await waitFor(() => expect(landed).toBe(personAt("p1")));

    await userEvent.click(await screen.findByRole("button", { name: /All People/ }));

    await waitFor(() => expect(landed).toBe(screens[0].at));
  });

  it("reads the name of whichever screen the person came from", async () => {
    open(personAt("p1"), { from: { path: screens[3].at, title: "Groups & Associations" } });
    await screen.findByText("Amara Kole");

    expect(screen.getByRole("button", { name: /Groups & Associations/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /All People/ })).toBeNull();
  });

  it("says plainly when the person belongs to no group", async () => {
    answers.actor_list_groups_for_actor = () => ({ items: [] });
    open(personAt("p1"));

    await screen.findByText("Amara Kole");

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_list_groups_for_actor", { actor_id: "p1" }));
    expect(screen.queryByText("Reading Circle")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Households", () => {
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
    expect(toolsCalled()).toEqual(new Set(["actor_list_join_requests_for_group"]));
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
    expect(toolsCalled()).toEqual(new Set(["comm_chat_thread_list"]));
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
