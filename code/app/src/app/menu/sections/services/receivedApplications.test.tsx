import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { FeesPaymentsScreen, LicencesScreen, PermitsScreen } from "./ServicesScreens";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const deciderPermissions = ["application.decide", "form.results", "form.answers.read"];

const entries = [
  { id: "e1", slug: "market-stall-permit", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1" },
  { id: "e3", slug: "dog-licence", name: "Dog Licence", summary: "Keep a dog in town", kind: "licence", form_id: "f3" },
  { id: "e4", slug: "hall-hire-fee", name: "Hall Hire Fee", summary: "Hire the town hall", kind: "fee", form_id: "f4" },
];

const people = [
  { id: "m1", display_name: "Bence Farkas" },
  { id: "m2", display_name: "Réka Tóth" },
  { id: "m3", display_name: "Dániel Kiss" },
];

const questions = [
  { id: "q1", prompt: "Stall location" },
  { id: "q2", prompt: "Number of trading days" },
];

const answersOf = (memberId: string) => [
  { id: `a1-${memberId}`, question_id: "q1", member_id: memberId, value_text: memberId === "m1" ? "Riverside Square" : "Mill Lane" },
  { id: `a2-${memberId}`, question_id: "q2", member_id: memberId, value_text: memberId === "m1" ? "Three" : "Five" },
];

const freshSubmissions = () => [
  { id: "s1", form_id: "f1", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z", paid: false },
  { id: "s2", form_id: "f1", member_id: "m2", submitted_at: "2026-03-02T12:00:00Z", paid: false, decision: "approved", decided_by: "m9", decided_at: "2026-03-09T12:00:00Z", decision_note: "" },
  { id: "s3", form_id: "f1", member_id: "m3", submitted_at: "2026-03-03T12:00:00Z", paid: false, decision: "refused", decided_by: "m9", decided_at: "2026-03-10T12:00:00Z", decision_note: "Too close to the fountain" },
];

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let submissions: Record<string, unknown>[];
let answers: Record<string, (args: Args) => unknown>;

beforeEach(() => {
  openAgency("town");
  permissions = deciderPermissions;
  submissions = freshSubmissions();
  answers = {
    agency_get_my_roles: () => ({ permissions }),
    forms_catalog_entry_list_public: (args) => ({ items: entries.filter((entry) => entry.kind === args.kind) }),
    forms_catalog_entry_read: (args) => ({ item: entries.find((entry) => entry.slug === args.slug) }),
    forms_catalog_entry_submissions_mine: () => [],
    forms_submission_list: (args) => ({ items: submissions.filter((submission) => submission.form_id === args.form_id) }),
    actor_list_actors: () => ({ items: people }),
    forms_question_list: () => ({ items: questions }),
    forms_answer_list_all: (args) => ({ items: answersOf(String(args.member_id)) }),
    forms_submission_decide: (args) => {
      const decided = { decision: args.decision, decided_by: "m9", decided_at: "2026-03-17T12:00:00Z", decision_note: args.note };
      submissions = submissions.map((submission) => (submission.member_id === args.member_id ? { ...submission, ...decided } : submission));
      return submissions.find((submission) => submission.member_id === args.member_id);
    },
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

const screens = {
  permit: { at: "/a/town/menu/services/permits", pattern: "/a/:agencyId/menu/services/permits", Screen: PermitsScreen, entry: "Market Stall Permit" },
  licence: { at: "/a/town/menu/services/licences", pattern: "/a/:agencyId/menu/services/licences", Screen: LicencesScreen, entry: "Dog Licence" },
  fee: { at: "/a/town/menu/services/fees", pattern: "/a/:agencyId/menu/services/fees", Screen: FeesPaymentsScreen, entry: "Hall Hire Fee" },
};

const openEntry = async (kind: keyof typeof screens = "permit") => {
  const { at, pattern, Screen, entry } = screens[kind];
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path={pattern} element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByText(entry));
  await screen.findByText("Not sent yet");
};

const rowOf = (name: string) => screen.findByRole("button", { name: new RegExp(name) });

const decideCalls = () => called.mock.calls.filter(([, name]) => name === "forms_submission_decide");

const openApplicationOf = async (name: string) => {
  await userEvent.click(await rowOf(name));
  await screen.findByText("Stall location");
};

const refuseWith = async (reason: string) => {
  if (!screen.queryByRole("textbox")) await userEvent.click(screen.getByRole("button", { name: "Refuse" }));
  if (reason !== "") await userEvent.type(await screen.findByRole("textbox"), reason);
  await userEvent.click(screen.getByRole("button", { name: "Refuse" }));
};

describe("Applications received on a permit or licence entry", () => {
  it.each([
    ["permit", "Market Stall Permit", "f1"],
    ["licence", "Dog Licence", "f3"],
  ] as const)("shows the section Applications received on a %s entry to a caller who may decide, read results and read answers", async (kind, _entry, formId) => {
    submissions = submissions.map((submission) => ({ ...submission, form_id: formId }));
    await openEntry(kind);

    expect(await screen.findByText("Applications received")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_submission_list", { form_id: formId });
    expect(await rowOf("Bence Farkas")).toBeInTheDocument();
  });

  it("draws one row per person, with the person's name from the actor list and never the member id", async () => {
    await openEntry();

    expect(await rowOf("Bence Farkas")).toBeInTheDocument();
    expect(await rowOf("Réka Tóth")).toBeInTheDocument();
    expect(await rowOf("Dániel Kiss")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "actor_list_actors", undefined);
    expect(screen.queryByText(/\bm1\b|\bm2\b|\bm3\b/)).toBeNull();
  });

  it("reads Sent with the day sent on a row that has no decision", async () => {
    await openEntry();

    const row = await rowOf("Bence Farkas");

    expect(row).toHaveTextContent("Sent");
    expect(row).toHaveTextContent("Wednesday, 4 Mar");
  });

  it("reads Approved with the day it was decided on an approved row", async () => {
    await openEntry();

    const row = await rowOf("Réka Tóth");

    expect(row).toHaveTextContent("Approved");
    expect(row).toHaveTextContent("Monday, 9 Mar");
    expect(row).not.toHaveTextContent("Sent");
  });

  it("reads Refused with the day it was decided on a refused row", async () => {
    await openEntry();

    const row = await rowOf("Dániel Kiss");

    expect(row).toHaveTextContent("Refused");
    expect(row).toHaveTextContent("Tuesday, 10 Mar");
    expect(row).not.toHaveTextContent("Sent");
  });

  it("opens a row to the answers that person gave, with each question's prompt, and offers Grant and Refuse", async () => {
    await openEntry();

    await openApplicationOf("Bence Farkas");

    expect(called).toHaveBeenCalledWith("", "forms_answer_list_all", { form_id: "f1", member_id: "m1" });
    expect(called).toHaveBeenCalledWith("", "forms_question_list", { form_id: "f1" });
    expect(screen.getByText("Riverside Square")).toBeInTheDocument();
    expect(screen.getByText("Number of trading days")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refuse" })).toBeInTheDocument();
  });

  it("grants with an empty note and then reads Approved on the row", async () => {
    await openEntry();
    await openApplicationOf("Bence Farkas");

    await userEvent.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_decide", { form_id: "f1", member_id: "m1", decision: "approved", note: "" }));
    await waitFor(async () => expect(await rowOf("Bence Farkas")).toHaveTextContent("Approved"));
    expect(await rowOf("Bence Farkas")).not.toHaveTextContent("Sent");
  });

  it("asks for a reason in a text field when Refuse is pressed and sends nothing while the reason is empty", async () => {
    await openEntry();
    await openApplicationOf("Bence Farkas");

    await refuseWith("");

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(decideCalls()).toHaveLength(0);
    expect(await rowOf("Bence Farkas")).toHaveTextContent("Sent");
  });

  it("refuses with the reason typed as the note and then reads Refused on the row", async () => {
    await openEntry();
    await openApplicationOf("Bence Farkas");

    await refuseWith("The stall would block the market gate");

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "forms_submission_decide", { form_id: "f1", member_id: "m1", decision: "refused", note: "The stall would block the market gate" }),
    );
    await waitFor(async () => expect(await rowOf("Bence Farkas")).toHaveTextContent("Refused"));
  });

  it("shows no section and never lists submissions to a caller without application.decide", async () => {
    permissions = ["form.results", "form.answers.read"];
    await openEntry();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByText("Applications received")).toBeNull();
    expect(called).not.toHaveBeenCalledWith("", "forms_submission_list", expect.anything());
    expect(screen.queryByRole("button", { name: /Bence Farkas/ })).toBeNull();
  });

  it("shows no section on a fee entry even to a caller who may decide", async () => {
    await openEntry("fee");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_submissions_mine", { slug: "hall-hire-fee" }));

    expect(screen.queryByText("Applications received")).toBeNull();
    expect(called).not.toHaveBeenCalledWith("", "forms_submission_list", expect.anything());
  });

  it("shows nothing and no error text when the list of submissions is refused", async () => {
    answers.forms_submission_list = () => {
      throw new mcp.McpError("forms.submission.list is not allowed for this seat");
    };
    await openEntry();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_list", { form_id: "f1" }));

    expect(screen.queryByText("Applications received")).toBeNull();
    expect(screen.queryByText(/not allowed|failed|error|refused/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Bence Farkas/ })).toBeNull();
  });

  it("shows nothing and no error text when the roles of the caller cannot be read", async () => {
    answers.agency_get_my_roles = () => {
      throw new Error("agency_get_my_roles is down");
    };
    await openEntry();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByText("Applications received")).toBeNull();
    expect(screen.queryByText(/down|failed|error/i)).toBeNull();
    expect(called).not.toHaveBeenCalledWith("", "forms_submission_list", expect.anything());
  });

  it("shows no error text when the answers of one application are refused on opening it", async () => {
    answers.forms_answer_list_all = () => {
      throw new mcp.McpError("forms.answer.list_all is not allowed for this seat");
    };
    await openEntry();

    await userEvent.click(await rowOf("Bence Farkas"));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_answer_list_all", { form_id: "f1", member_id: "m1" }));

    expect(screen.queryByText(/not allowed|failed|error/i)).toBeNull();
    expect(decideCalls()).toHaveLength(0);
  });
});
