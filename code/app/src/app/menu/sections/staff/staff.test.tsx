import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { CrewsScreen, DepartmentsScreen, RolesPermissionsScreen, StaffMemberScreen, StaffScreen } from "./index";

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

    await userEvent.click(backButton(/^Staff$/));

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

describe("a staff member", () => {
  const member = (id: string) => {
    called = answering(staffAnswers);
    return open(`/a/town/menu/staff/people/${id}`, <StaffMemberScreen />, "/menu/staff/people/:id");
  };

  it("reads the actor, the seats and the standing for the person in the address", async () => {
    member("a1");
    await waitFor(() => expect(document.body.textContent).toContain("Clerk"));

    expect(callsTo("actor_get_actor")[0][2]).toEqual({ actor_id: "a1" });
    expect(callsTo("actor_list_role_assignments_for_actor")[0][2]).toEqual({ actor_id: "a1" });
    expect(callsTo("actor_get_actor_standing")[0][2]).toEqual({ actor_id: "a1" });
  });

  it("shows the role, the department and In post for a seat that has not ended", async () => {
    member("a1");

    expect(await screen.findByText("Anna Sample")).toBeInTheDocument();
    await waitFor(() => expect(document.body.textContent).toContain("Clerk"));
    expect(document.body.textContent).toContain("Registry");
    expect(document.body.textContent).toContain("In post");
  });

  it("shows one row for each seat, and how an ended seat ended", async () => {
    member("a2");
    await waitFor(() => expect(document.body.textContent).toContain("Surveyor"));

    expect(document.body.textContent).toContain("Planner");
    expect(document.body.textContent).toContain("Planning");
    expect(document.body.textContent).toContain("In post");
    expect(document.body.textContent).toMatch(/resigned/i);
  });

  it("has a Back button that names the Staff list it came from and goes there", async () => {
    called = answering(staffAnswers);
    render(
      <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/staff/people/a1", state: { from: { path: "/a/town/menu/staff/people", title: "Staff" } } }]}>
        <Routes>
          <Route path="/a/:agencyId/menu/staff/people/:id" element={<StaffMemberScreen />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.body.textContent).toContain("Clerk"));

    await userEvent.click(backButton(/^Staff$/));

    await waitFor(() => expect(landed).toBe("/a/town/menu/staff/people"));
  });
});

const departments = [
  { id: "g1", name: "Sample Public Works" },
  { id: "g2", name: "Sample Registry" },
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

    await userEvent.click(backButton(/^Departments$/));

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
  { id: "g3", name: "Sample Road Crew" },
  { id: "g4", name: "Sample Water Crew" },
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

    await userEvent.click(backButton(/^Crews$/));

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

const roles = [
  { id: "r1", name: "Sample Clerk" },
  { id: "r2", name: "Sample Registrar" },
  { id: "r3", name: "Sample Planner" },
];

const roleAssignments = [
  { id: "x1", work_item_id: "w1", role_id: "r1", label: "R" },
  { id: "x2", work_item_id: "w2", role_id: "r1", label: "A" },
  { id: "x3", work_item_id: "w1", role_id: "r2", label: "A" },
];

const roleAnswers: Answers = {
  agency_list_roles: () => ({ items: roles }),
  agency_list_role_assignments: () => ({ items: roleAssignments }),
};

describe("the Roles & Permissions list", () => {
  const screens = () => {
    called = answering(roleAnswers);
    return open("/a/town/menu/staff/roles", <RolesPermissionsScreen />, "/menu/staff/roles");
  };

  it("draws one row for each role, with how many assignments name that role", async () => {
    screens();

    expect(await screen.findByText("Sample Clerk")).toBeInTheDocument();
    expect(await screen.findByText("2 people")).toBeInTheDocument();
    expect(screen.getByText("Sample Registrar")).toBeInTheDocument();
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.getByText("Sample Planner")).toBeInTheDocument();
    expect(screen.getByText("0 people")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roles & Permissions" })).toBeInTheDocument();
  });

  it("reads the roles and the assignments once each, not once per row", async () => {
    screens();
    await screen.findByText("2 people");

    expect(callsTo("agency_list_roles")).toHaveLength(1);
    expect(callsTo("agency_list_role_assignments")).toHaveLength(1);
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

    await userEvent.click(backButton(/^Roles & Permissions$/));

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
