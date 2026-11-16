import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { CrewsScreen, DepartmentsScreen, RolesPermissionsScreen, StaffScreen } from "./index";

type Args = Record<string, unknown> | undefined;

type Answers = Record<string, (args: Args) => unknown>;

const origin = { path: "/a/town/menu/staff", title: "Staff & Departments" };

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answering = (answers: Answers) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => (answers[name] ? answers[name](args as Args) : { items: [] }));

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const backButton = (name: RegExp) => screen.getByRole("button", { name });

const open = (path: string, element: JSX.Element, pattern = path) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state: { from: origin } }]}>
      <Routes>
        <Route path={`/a/:agencyId${pattern}`} element={element} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const actors = [
  { id: "a1", display_name: "Anna Sample" },
  { id: "a2", display_name: "Ben Sample" },
  { id: "a3", display_name: "Csilla Sample" },
];

const staffGroups = [
  { id: "g1", name: "Registry" },
  { id: "g2", name: "Planning" },
];

const seatsOfGroup: Record<string, unknown[]> = {
  g1: [{ id: "s1", actor_id: "a1", group_id: "g1", kind_id: "k1", role_name: "Clerk", group_name: "Registry", active: true }],
  g2: [{ id: "s2", actor_id: "a2", group_id: "g2", kind_id: "k2", role_name: "Planner", active: true }],
};

const seatsOfActor: Record<string, unknown[]> = {
  a1: [{ id: "s1", actor_id: "a1", group_id: "g1", kind_id: "k1", role_name: "Clerk", group_name: "Registry", active: true }],
  a2: [
    { id: "s2", actor_id: "a2", group_id: "g2", kind_id: "k2", role_name: "Planner", group_name: "Planning", active: true },
    { id: "s3", actor_id: "a2", group_id: "g1", kind_id: "k3", role_name: "Surveyor", group_name: "Registry", active: false },
  ],
};

const standingOf: Record<string, unknown> = {
  a1: {
    actor_id: "a1",
    display_name: "Anna Sample",
    registrations: [],
    seats: [{ id: "s1", group_id: "g1", group_name: "Registry", kind_id: "k1", role_name: "Clerk", granted_at: "2026-01-05" }],
  },
  a2: {
    actor_id: "a2",
    display_name: "Ben Sample",
    registrations: [],
    seats: [
      { id: "s2", group_id: "g2", group_name: "Planning", kind_id: "k2", role_name: "Planner", granted_at: "2026-02-01" },
      { id: "s3", group_id: "g1", group_name: "Registry", kind_id: "k3", role_name: "Surveyor", granted_at: "2025-03-01", ended_at: "2025-12-01", ended_reason: "resigned" },
    ],
  },
};

const staffAnswers: Answers = {
  actor_list_actors: () => ({ items: actors }),
  actor_list_groups: () => ({ items: staffGroups }),
  actor_list_role_assignments_for_group: (args) => ({ items: seatsOfGroup[String(args?.group_id)] ?? [] }),
  actor_get_actor: (args) => actors.find((actor) => actor.id === args?.actor_id) ?? {},
  actor_list_role_assignments_for_actor: (args) => ({ items: seatsOfActor[String(args?.actor_id)] ?? [] }),
  actor_get_actor_standing: (args) => standingOf[String(args?.actor_id)] ?? {},
};

const staff = () => {
  called = answering(staffAnswers);
  return open("/a/town/menu/staff/people", <StaffScreen />, "/menu/staff/people");
};

const openStaff = (path: string) => open(path, <StaffScreen />, "/menu/staff/people");

describe("the Staff list", () => {
  it("draws one row for each person the hub lists, named from actor_list_actors", async () => {
    staff();

    expect(await screen.findByText("Anna Sample")).toBeInTheDocument();
    expect(screen.getByText("Ben Sample")).toBeInTheDocument();
    expect(screen.getByText("Csilla Sample")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Staff" })).toBeInTheDocument();
    expect(callsTo("actor_list_actors")).toHaveLength(1);
  });

  it("puts the role from the group's seats on a row, with the department when the seat names one", async () => {
    staff();

    expect(await screen.findByText("Clerk · Registry")).toBeInTheDocument();
  });

  it("leaves the department out when the seat does not name one", async () => {
    staff();

    expect(await screen.findByText("Planner")).toBeInTheDocument();
    expect(screen.queryByText(/Planner ·/)).toBeNull();
  });

  it("draws a person with no seat as a name alone", async () => {
    staff();
    await screen.findByText("Csilla Sample");

    const row = screen.getByRole("button", { name: /Csilla Sample/ });
    expect(row.textContent).not.toContain("·");
  });

  it("asks for the seats of each group through actor_list_role_assignments_for_group", async () => {
    staff();
    await screen.findByText("Clerk · Registry");

    expect(callsTo("actor_list_role_assignments_for_group").map(([, , args]) => (args as { group_id: string }).group_id).sort()).toEqual(["g1", "g2"]);
  });

  it("filters the rows already loaded as the person types", async () => {
    staff();
    await screen.findByText("Anna Sample");

    await userEvent.type(screen.getByRole("searchbox"), "ben");

    expect(screen.getByText("Ben Sample")).toBeInTheDocument();
    expect(screen.queryByText("Anna Sample")).toBeNull();
    expect(callsTo("actor_list_actors")).toHaveLength(1);
  });

  it("opens the person beside the list when a row is pressed, asking for that actor", async () => {
    staff();
    await userEvent.click(await screen.findByRole("button", { name: /Anna Sample/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Clerk"));
    expect(pane().textContent).toContain("Registry");
    expect(callsTo("actor_get_actor")[0][2]).toEqual({ actor_id: "a1" });
  });

  it("goes back from an opened person to the list, and the Back button names the Staff list", async () => {
    staff();
    await userEvent.click(await screen.findByRole("button", { name: /Anna Sample/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(backButton(/‹ Staff$/));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Ben Sample")).toBeInTheDocument();
  });

  it("names Staff & Departments on Back when no row is opened, and goes there", async () => {
    staff();
    await screen.findByText("Anna Sample");

    await userEvent.click(backButton(/Staff & Departments/));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the hub lists no staff", async () => {
    called = answering({ ...staffAnswers, actor_list_actors: () => ({ items: [] }) });
    openStaff("/a/town/menu/staff/people");

    expect(await screen.findByText(/No staff/i)).toBeInTheDocument();
  });
});

describe("the Staff list with people who have no display name", () => {
  const unnamed = [
    { id: "a4", code: "AC-15", display_name: "", first_name: "", last_name: "" },
    { id: "a5", code: "AC-16", display_name: "", first_name: "Réka", last_name: "Tóth" },
  ];

  it("draws the first and last name, or else the code, instead of a blank row", async () => {
    called = answering({ ...staffAnswers, actor_list_actors: () => ({ items: [...actors, ...unnamed] }) });
    openStaff("/a/town/menu/staff/people");

    expect(await screen.findByText("AC-15")).toBeInTheDocument();
    expect(screen.getByText("Réka Tóth")).toBeInTheDocument();
    expect(screen.getAllByRole("button").filter((button) => button.textContent === "" && !button.hasAttribute("aria-label"))).toHaveLength(0);
  });

  it("draws the code on the opened person's card", async () => {
    called = answering({ ...staffAnswers, actor_list_actors: () => ({ items: unnamed }), actor_get_actor: () => unnamed[0] });
    openStaff("/a/town/menu/staff/people");
    await userEvent.click(await screen.findByRole("button", { name: /AC-15/ }));

    await waitFor(() => expect(pane().textContent).toContain("AC-15"));
  });
});

describe("the Staff window's seats", () => {
  const setWide = (wide: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: wide,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  };

  afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

  const choose = async (name: RegExp) => {
    staff();
    await userEvent.click(await screen.findByRole("button", { name }));
    await waitFor(() => expect(pane()).not.toBeNull());
  };

  it("draws a seat of the chosen person with its group and In post beside the list at wide", async () => {
    setWide(true);
    await choose(/Anna Sample/);

    await waitFor(() => expect(pane().textContent).toContain("Seats"));
    expect(pane().textContent).toContain("In post");
    expect(document.querySelector(".wf-tree")).not.toBeNull();
  });

  it("draws every seat of the chosen person and how an ended seat ended", async () => {
    setWide(true);
    await choose(/Ben Sample/);

    await waitFor(() => expect(pane().textContent).toContain("Surveyor"));
    expect(pane().textContent).toContain("Planner");
    expect(pane().textContent).toContain("Planning");
    expect(pane().textContent).toMatch(/Ended · resigned/);
    expect(callsTo("actor_get_actor")[0][2]).toEqual({ actor_id: "a2" });
    expect(callsTo("actor_list_role_assignments_for_actor")[0][2]).toEqual({ actor_id: "a2" });
    expect(callsTo("actor_get_actor_standing")[0][2]).toEqual({ actor_id: "a2" });
  });

  it("draws the seats in the phone's detail too", async () => {
    setWide(false);
    await choose(/Ben Sample/);

    await waitFor(() => expect(pane().textContent).toMatch(/Ended · resigned/));
  });
});

const departments = [
  { id: "g1", name: "Sample Public Works", node_type: "Department" },
  { id: "g2", name: "Sample Registry", node_type: "Department" },
  { id: "g6", name: "Sample Audit Committee", node_type: "Committee" },
  { id: "g7", name: "Sample Road Crew", node_type: "Crew" },
  { id: "g8", name: "Sample walk group" },
];

const populations: Record<string, number> = { g1: 12, g2: 1 };

const departmentAnswers: Answers = {
  actor_list_groups: () => ({ items: departments }),
  actor_get_group_population: (args) => ({ group_id: args?.group_id, population: populations[String(args?.group_id)] }),
};

describe("the Departments list", () => {
  const screens = () => {
    called = answering(departmentAnswers);
    return open("/a/town/menu/staff/departments", <DepartmentsScreen />, "/menu/staff/departments");
  };

  it("draws one row for each group the hub lists, with its head count from actor_get_group_population", async () => {
    screens();

    expect(await screen.findByText("Sample Public Works")).toBeInTheDocument();
    expect(await screen.findByText("12 people")).toBeInTheDocument();
    expect(screen.getByText("Sample Registry")).toBeInTheDocument();
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Departments" })).toBeInTheDocument();
    expect(callsTo("actor_get_group_population").map(([, , args]) => (args as { group_id: string }).group_id).sort()).toEqual(["g1", "g2"]);
  });

  it("leaves out every group whose type is not Department", async () => {
    screens();
    await screen.findByText("Sample Public Works");

    expect(screen.queryByText("Sample Audit Committee")).toBeNull();
    expect(screen.queryByText("Sample Road Crew")).toBeNull();
    expect(screen.queryByText("Sample walk group")).toBeNull();
  });

  it("opens the department beside the list when a row is pressed, with its head count", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Public Works/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("12 people"));
  });

  it("goes from an opened department back to the Departments list, and Back names it", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Public Works/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(backButton(/‹ Departments$/));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Sample Registry")).toBeInTheDocument();
  });

  it("names Staff & Departments on Back from the list, and goes there", async () => {
    screens();
    await screen.findByText("Sample Public Works");

    await userEvent.click(backButton(/Staff & Departments/));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the hub lists no departments", async () => {
    called = answering({ ...departmentAnswers, actor_list_groups: () => ({ items: [] }) });
    open("/a/town/menu/staff/departments", <DepartmentsScreen />, "/menu/staff/departments");

    expect(await screen.findByText(/No departments/i)).toBeInTheDocument();
  });
});

const crews = [
  { id: "g3", name: "Sample Road Crew", node_type: "Crew" },
  { id: "g4", name: "Sample Water Crew", node_type: "Crew" },
  { id: "g5", name: "Sample Public Works", node_type: "Department" },
  { id: "g9", name: "Sample walk group" },
];

const leadersOf: Record<string, unknown[]> = {
  g3: [{ actor_id: "a1", display_name: "Anna Sample" }],
  g4: [{ actor_id: "a2", display_name: "Ben Sample" }],
};

const crewAnswers: Answers = {
  actor_list_groups: () => ({ items: crews }),
  actor_list_group_leaders: (args) => ({ items: leadersOf[String(args?.group_id)] ?? [] }),
};

describe("the Crews list", () => {
  const screens = () => {
    called = answering(crewAnswers);
    return open("/a/town/menu/staff/crews", <CrewsScreen />, "/menu/staff/crews");
  };

  it("draws one row for each crew the hub lists, with its leader from actor_list_group_leaders", async () => {
    screens();

    expect(await screen.findByText("Sample Road Crew")).toBeInTheDocument();
    expect(await screen.findByText("Leader: Anna Sample")).toBeInTheDocument();
    expect(screen.getByText("Sample Water Crew")).toBeInTheDocument();
    expect(screen.getByText("Leader: Ben Sample")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crews" })).toBeInTheDocument();
    expect(callsTo("actor_list_group_leaders").map(([, , args]) => (args as { group_id: string }).group_id).sort()).toEqual(["g3", "g4"]);
  });

  it("leaves out every group whose type is not Crew", async () => {
    screens();
    await screen.findByText("Sample Road Crew");

    expect(screen.queryByText("Sample Public Works")).toBeNull();
    expect(screen.queryByText("Sample walk group")).toBeNull();
  });

  it("opens the crew beside the list when a row is pressed, with its leader", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Road Crew/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Anna Sample"));
  });

  it("goes from an opened crew back to the Crews list, and Back names it", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Road Crew/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(backButton(/‹ Crews$/));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Sample Water Crew")).toBeInTheDocument();
  });

  it("names Staff & Departments on Back from the list, and goes there", async () => {
    screens();
    await screen.findByText("Sample Road Crew");

    await userEvent.click(backButton(/Staff & Departments/));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the hub lists no crews", async () => {
    called = answering({ ...crewAnswers, actor_list_groups: () => ({ items: [] }) });
    open("/a/town/menu/staff/crews", <CrewsScreen />, "/menu/staff/crews");

    expect(await screen.findByText(/No crews/i)).toBeInTheDocument();
  });
});

const publications = [
  { channel: "", version: 3, draft_id: "d-old" },
  { channel: "production", version: 4, draft_id: "d-live" },
];

const roles = [
  { id: "r1", code: "R-1", name: "Sample Clerk" },
  { id: "r2", code: "R-2", name: "Sample Registrar" },
  { id: "r3", code: "R-3", name: "Sample Planner" },
];

const roleKinds = [
  { id: "k1", name: "Sample Clerk", definition_role_id: "R-1" },
  { id: "k2", name: "Sample Registrar", definition_role_id: "R-2" },
  { id: "k3", name: "Sample Planner", definition_role_id: "R-3" },
];

const holdersOfKind: Record<string, unknown[]> = {
  k1: [
    { id: "s1", actor_id: "a1", group_id: "g1", kind_id: "k1", active: true, display_name: "Anna Sample" },
    { id: "s2", actor_id: "a2", group_id: "g1", kind_id: "k1", active: true, display_name: "Ben Sample" },
    { id: "s3", actor_id: "a1", group_id: "g2", kind_id: "k1", active: true, display_name: "Anna Sample" },
    { id: "s4", actor_id: "a3", group_id: "g1", kind_id: "k1", active: false, ended_at: "2026-01-01" },
  ],
  k2: [{ id: "s5", actor_id: "a2", group_id: "g2", kind_id: "k2", active: true }],
};

const roleAnswers: Answers = {
  agency_list_publications: () => ({ items: publications }),
  agency_list_roles: () => ({ items: roles }),
  actor_list_role_kinds: () => ({ items: roleKinds }),
  actor_list_role_holders: (args) => ({ items: holdersOfKind[String(args?.kind_id)] ?? [] }),
};

describe("the Roles & Permissions list", () => {
  const screens = () => {
    called = answering(roleAnswers);
    return open("/a/town/menu/staff/roles", <RolesPermissionsScreen />, "/menu/staff/roles");
  };

  it("draws one row for each role, with how many people hold the role kind it defines", async () => {
    screens();

    expect(await screen.findByText("Sample Clerk")).toBeInTheDocument();
    expect(await screen.findByText("2 people")).toBeInTheDocument();
    expect(screen.getByText("Sample Registrar")).toBeInTheDocument();
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.getByText("Sample Planner")).toBeInTheDocument();
    expect(screen.getByText("0 people")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roles & Permissions" })).toBeInTheDocument();
  });

  it("counts a person once however many departments they hold the role in, and leaves out ended seats", async () => {
    screens();
    await screen.findByText("2 people");

    expect(screen.queryByText("3 people")).toBeNull();
    expect(screen.queryByText("4 people")).toBeNull();
  });

  it("does not count RACI links, and asks the holders of each role kind once", async () => {
    screens();
    await screen.findByText("2 people");

    expect(callsTo("agency_list_roles")).toHaveLength(1);
    expect(callsTo("agency_list_role_assignments")).toHaveLength(0);
    expect(callsTo("actor_list_role_holders").map(([, , args]) => (args as { kind_id: string }).kind_id).sort()).toEqual(["k1", "k2", "k3"]);
  });

  it("opens the role beside the list when a row is pressed, with its count of holders", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Clerk/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("2 people"));
  });

  it("goes from an opened role back to the list, and Back names Roles & Permissions", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Clerk/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(backButton(/‹ Roles & Permissions$/));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Sample Registrar")).toBeInTheDocument();
  });

  it("names Staff & Departments on Back from the list, and goes there", async () => {
    screens();
    await screen.findByText("Sample Clerk");

    await userEvent.click(backButton(/Staff & Departments/));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the agency has no roles", async () => {
    called = answering({ ...roleAnswers, agency_list_roles: () => ({ items: [] }) });
    open("/a/town/menu/staff/roles", <RolesPermissionsScreen />, "/menu/staff/roles");

    expect(await screen.findByText(/No roles/i)).toBeInTheDocument();
  });
});
