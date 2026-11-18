import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { dateTimeWords, dayWords } from "../../../../shared/ui/days";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = Record<string, unknown>;

let called: MockInstance<typeof mcp.callTool>;
let auditEntries: Row[];
let bookings: Row[];
let auditRefused: boolean;
let bookingsRefused: boolean;

const people = [
  { id: "p1", display_name: "Sample Resident A", status: "active" },
  { id: "p2", display_name: "Sample Official B", status: "active" },
];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view"] };
  if (name === "actor_list_actors") return { items: [people[0]] };
  if (name === "actor_get_actor") return people[0];
  if (name === "actor_get_actors") return { items: people.filter((person) => [given.id].flat().includes(person.id)) };
  if (name === "actor_list_groups_for_actor") return { items: [] };
  if (name === "actor_list_groups") return { items: [] };
  if (name === "actor_list_attribute_properties") return { items: [] };
  if (name === "forms_submission_list_of_person") return { items: [] };
  if (name === "audit_list_entries") {
    if (auditRefused) throw new mcp.McpError("audit_list_entries: the hub refused this");
    return { items: auditEntries.filter((entry) => entry.actor === given.actor || entry.subject === given.subject) };
  }
  if (name === "forms_catalog_booking_list_of_person") {
    if (bookingsRefused) throw new mcp.McpError("forms_catalog_booking_list_of_person: the hub refused this");
    return { items: bookings.filter((booking) => booking.holder_id === given.actor_id) };
  }
  throw new Error(`${name}: unknown tool`);
};

const entry = (id: string, at: string, action: string, over: Row = {}) => ({ id, actor: "p1", action, subject: "req-1", at, ...over });

const booking = (id: string, day: string, over: Row = {}) => ({
  id,
  slot_id: "slot-1",
  subject_id: "Sample Clinic Visit",
  holder_id: "p1",
  day,
  starts_at: `${day}T09:00:00Z`,
  cancelled_at: "",
  cancelled_by: "",
  cancel_reason: "",
  created_at: "2026-11-01T08:00:00Z",
  ...over,
});

beforeEach(() => {
  openAgency("town");
  auditEntries = [];
  bookings = [];
  auditRefused = false;
  bookingsRefused = false;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openPerson = async () => {
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample Resident A/ }));
  await screen.findByRole("heading", { name: /^Groups/ });
};

const calledNames = () => called.mock.calls.map((call) => String(call[1]));

const settledOn = async (...tools: string[]) => waitFor(() => tools.forEach((tool) => expect(calledNames()).toContain(tool)));

const order = (first: string, second: string) => {
  const one = screen.getByText(first);
  const two = screen.getByText(second);
  return one.compareDocumentPosition(two) & Node.DOCUMENT_POSITION_FOLLOWING ? "first" : "second";
};

describe("activity on a person's detail", () => {
  it("shows the Activity heading with a row for an audit entry and a row for a booking", async () => {
    auditEntries = [entry("e1", "2026-11-12T14:30:00Z", "closed a request")];
    bookings = [booking("b1", "2026-11-20")];

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Activity/ })).toBeTruthy();
    expect(await screen.findByText("closed a request: req-1")).toBeTruthy();
    expect(screen.getByText(`Sample Resident A · ${dateTimeWords("2026-11-12T14:30:00Z")}`)).toBeTruthy();
    expect(await screen.findByText("Sample Clinic Visit")).toBeTruthy();
    expect(screen.getByText(dayWords("2026-11-20"))).toBeTruthy();
  });

  it("asks for the audit entries by actor and by subject and for the bookings by the person id", async () => {
    await openPerson();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "audit_list_entries", { actor: "p1" }));
    expect(called).toHaveBeenCalledWith("", "audit_list_entries", { subject: "p1" });
    expect(called).toHaveBeenCalledWith("", "forms_catalog_booking_list_of_person", { actor_id: "p1" });
  });

  it("shows an entry that is both by and about the person once", async () => {
    auditEntries = [entry("e1", "2026-11-12T14:30:00Z", "closed a request", { subject: "p1" })];

    await openPerson();

    expect(await screen.findAllByText(/closed a request/)).toHaveLength(1);
  });

  it("shows the entries by the person and the entries about the person together, newest first", async () => {
    auditEntries = [
      entry("e1", "2026-11-10T08:00:00Z", "opened a request"),
      entry("e2", "2026-11-12T14:30:00Z", "granted a role", { actor: "p2", subject: "p1" }),
      entry("e3", "2026-11-11T10:15:00Z", "closed a request"),
    ];

    await openPerson();

    await screen.findByText(/granted a role/);
    expect(order("granted a role: Sample Resident A", "closed a request: req-1")).toBe("first");
    expect(order("closed a request: req-1", "opened a request: req-1")).toBe("first");
    expect(screen.getByText(`Sample Official B · ${dateTimeWords("2026-11-12T14:30:00Z")}`)).toBeTruthy();
  });

  it("marks a cancelled booking and leaves a standing booking unmarked", async () => {
    bookings = [
      booking("b1", "2026-11-20", { subject_id: "Sample Standing Visit" }),
      booking("b2", "2026-11-21", { subject_id: "Sample Cancelled Visit", cancelled_at: "2026-11-15T12:00:00Z", cancelled_by: "p1" }),
    ];

    await openPerson();

    expect(await screen.findByText(`${dayWords("2026-11-21")} · Cancelled`)).toBeTruthy();
    expect(screen.getByText(dayWords("2026-11-20"))).toBeTruthy();
    expect(screen.getAllByText(/ · Cancelled$/)).toHaveLength(1);
  });

  it("still shows the bookings when the audit entries are refused, with no error text", async () => {
    auditRefused = true;
    bookings = [booking("b1", "2026-11-20")];

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Activity/ })).toBeTruthy();
    expect(await screen.findByText("Sample Clinic Visit")).toBeTruthy();
    expect(screen.queryByText(/the hub refused this/)).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  it("still shows the audit entries when the bookings are refused, with no error text", async () => {
    bookingsRefused = true;
    auditEntries = [entry("e1", "2026-11-12T14:30:00Z", "closed a request")];

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Activity/ })).toBeTruthy();
    expect(await screen.findByText("closed a request: req-1")).toBeTruthy();
    expect(screen.queryByText(/the hub refused this/)).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  it("shows no Activity heading and no error when both sources are refused, and the Groups still show", async () => {
    auditRefused = true;
    bookingsRefused = true;

    await openPerson();

    await settledOn("audit_list_entries", "forms_catalog_booking_list_of_person");
    expect(screen.getByRole("heading", { name: /^Groups/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Activity/ })).toBeNull();
    expect(screen.queryByText("No other activity yet.")).toBeNull();
    expect(screen.queryByText(/the hub refused this/)).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  it("shows an empty card when both sources answer with nothing", async () => {
    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Activity/ })).toBeTruthy();
    expect(await screen.findByText("No other activity yet.")).toBeTruthy();
  });

  it("never reads a notification of the person", async () => {
    auditEntries = [entry("e1", "2026-11-12T14:30:00Z", "closed a request")];
    bookings = [booking("b1", "2026-11-20")];

    await openPerson();

    await screen.findByText("Sample Clinic Visit");
    expect(calledNames().filter((name) => name.includes("notification"))).toEqual([]);
  });
});
