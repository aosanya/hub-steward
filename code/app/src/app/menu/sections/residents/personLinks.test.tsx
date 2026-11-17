import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { dayWords } from "../../../../shared/ui/days";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Failure = "none" | "refused" | "unknown";

let called: MockInstance<typeof mcp.callTool>;
let forms: Record<string, unknown>[];
let submissions: Record<string, Record<string, unknown>[]>;
let formListFailure: Failure;
let refusedSubmissionForms: string[];

const refusalWords = "forms_form_list: the hub refused this";

const guessedTools = ["accounting_payment_list", "digitaltwin_tenure_list"];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view"] };
  if (name === "actor_list_actors") return { items: [{ id: "p1", display_name: "Sample Resident A", status: "active" }] };
  if (name === "actor_get_actor") return { id: "p1", display_name: "Sample Resident A", status: "active" };
  if (name === "actor_list_groups_for_actor") return { items: [{ group_id: "g1" }] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: "Sample Street Group" }] };
  if (name === "actor_list_attribute_properties") return { items: [] };
  if (name === "forms_form_list") {
    if (formListFailure === "refused") throw new mcp.McpError(refusalWords);
    if (formListFailure === "unknown") throw new Error("forms_form_list: unknown tool");
    return { items: forms };
  }
  if (name === "forms_submission_list") {
    const formId = String(given.form_id);
    if (refusedSubmissionForms.includes(formId)) throw new mcp.McpError("forms_submission_list: the hub refused this form");
    return { items: (submissions[formId] ?? []).filter((row) => row.member_id === given.member_id) };
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  formListFailure = "none";
  refusedSubmissionForms = [];
  forms = [
    { id: "f1", title: "Sample Stall Permit" },
    { id: "f2", title: "Sample Parking Permit" },
  ];
  submissions = {};
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
  await screen.findByText("Sample Street Group");
};

const submission = (id: string, formId: string, sentAt: string) => ({ id, form_id: formId, member_id: "p1", submitted_at: sentAt });

const calledNames = () => called.mock.calls.map((call) => call[1]);

describe("applications on a person's detail", () => {
  it("shows the Applications heading and a row for a submission on one form, asked for by form and person id", async () => {
    submissions = { f1: [submission("s1", "f1", "2026-11-03T09:30:00Z")] };

    await openPerson();

    expect(await screen.findByRole("heading", { name: "Applications" })).toBeTruthy();
    expect(await screen.findByText("Sample Stall Permit")).toBeTruthy();
    expect(screen.getByText(`Sent ${dayWords("2026-11-03T09:30:00Z")}`)).toBeTruthy();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_list", { form_id: "f1", member_id: "p1" }));
  });

  it("shows one row for each form with a submission and none for a form without", async () => {
    forms = [...forms, { id: "f3", title: "Sample Market Licence" }];
    submissions = {
      f1: [submission("s1", "f1", "2026-11-03T09:30:00Z")],
      f2: [submission("s2", "f2", "2026-11-05T14:00:00Z")],
    };

    await openPerson();

    expect(await screen.findByText("Sample Stall Permit")).toBeTruthy();
    expect(await screen.findByText("Sample Parking Permit")).toBeTruthy();
    expect(screen.queryByText("Sample Market Licence")).toBeNull();
    expect(screen.getAllByText(/^Sent /)).toHaveLength(2);
  });

  it("shows an empty card when the person has sent no application", async () => {
    await openPerson();

    expect(await screen.findByRole("heading", { name: "Applications" })).toBeTruthy();
    expect(await screen.findByText("No applications yet.")).toBeTruthy();
    expect(screen.queryByText(/^Sent /)).toBeNull();
  });

  it.each<[string, Failure]>([
    ["refused", "refused"],
    ["not served", "unknown"],
  ])("shows no Applications and no error when the form list is %s, and the Groups still show", async (_label, failure) => {
    formListFailure = failure;

    await openPerson();

    await waitFor(() => expect(calledNames()).toContain("forms_form_list"));
    expect(screen.getByRole("heading", { name: "Groups" })).toBeTruthy();
    expect(screen.getByText("Sample Street Group")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Applications" })).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
    expect(screen.queryByText(/the hub refused this/)).toBeNull();
    expect(screen.queryByText(/unknown tool/)).toBeNull();
  });

  it("keeps the rows of a working form when another form's submissions are refused", async () => {
    submissions = {
      f1: [submission("s1", "f1", "2026-11-03T09:30:00Z")],
      f2: [submission("s2", "f2", "2026-11-05T14:00:00Z")],
    };
    refusedSubmissionForms = ["f2"];

    await openPerson();

    expect(await screen.findByText("Sample Stall Permit")).toBeTruthy();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_list", { form_id: "f2", member_id: "p1" }));
    expect(screen.queryByText("Sample Parking Permit")).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
    expect(screen.queryByText(/the hub refused this form/)).toBeNull();
  });

  it("claims no other kind of record: no guessed list is called and no other heading appears", async () => {
    submissions = { f1: [submission("s1", "f1", "2026-11-03T09:30:00Z")] };

    await openPerson();

    expect(await screen.findByRole("heading", { name: "Applications" })).toBeTruthy();
    expect(calledNames().filter((name) => guessedTools.includes(String(name)))).toEqual([]);
    for (const heading of ["Payments", "Holdings"]) {
      expect(screen.queryByRole("heading", { name: heading })).toBeNull();
    }
  });
});
