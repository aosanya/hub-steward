import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { dayWords } from "../../../../shared/ui/days";
import { ApplicationScreen } from "./ApplicationScreen";
import { PermitsScreen } from "./ServicesScreens";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const councilPermissions = ["application.decide", "form.results", "form.answers.read"];

const inspectorPermissions = [...councilPermissions, "application.inspect"];

const inspectedOn = "2026-03-12T12:00:00Z";

const finding = { inspection_result: "does_not_comply", inspected_by: "m8", inspected_at: inspectedOn, inspection_note: "Fence measured at 2.4 m on the street side" };

const resultWords = { complies: "Complies", does_not_comply: "Does not comply", needs_more: "Needs more" };

const entries = [{ id: "e1", slug: "market-stall-permit", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1" }];

const people = [
  { id: "m1", display_name: "Bence Farkas" },
  { id: "m2", display_name: "Réka Tóth" },
];

const questions = [
  { id: "q1", prompt: "Stall location" },
  { id: "q2", prompt: "Number of trading days" },
];

const answersOf = (memberId: string) => [
  { id: `a1-${memberId}`, question_id: "q1", member_id: memberId, value_text: "Riverside Square" },
  { id: `a2-${memberId}`, question_id: "q2", member_id: memberId, value_text: "Three" },
];

const freshSubmissions = () => [
  { id: "s1", form_id: "f1", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z", paid: false },
  { id: "s2", form_id: "f1", member_id: "m2", submitted_at: "2026-03-02T12:00:00Z", paid: false, ...finding },
];

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let submissions: Record<string, unknown>[];
let answers: Record<string, (args: Args) => unknown>;

beforeEach(() => {
  openAgency("town");
  permissions = inspectorPermissions;
  submissions = freshSubmissions();
  answers = {
    agency_get_my_roles: () => ({ permissions }),
    actor_get_my_actor: () => ({ id: "m9" }),
    forms_catalog_entry_list_public: (args) => ({ items: entries.filter((entry) => entry.kind === args.kind) }),
    forms_catalog_entry_read: (args) => ({ item: entries.find((entry) => entry.slug === args.slug) }),
    forms_catalog_entry_submissions_mine: () => [],
    forms_submission_list: (args) => ({ items: submissions.filter((submission) => submission.form_id === args.form_id) }),
    actor_list_actors: () => ({ items: people }),
    forms_question_list: () => ({ items: questions }),
    forms_answer_list_all: (args) => ({ items: answersOf(String(args.member_id)) }),
    forms_submission_inspect: (args) => {
      const recorded = { inspection_result: args.result, inspected_by: "m8", inspected_at: "2026-03-17T12:00:00Z", inspection_note: args.note ?? "" };
      submissions = submissions.map((submission) => (submission.member_id === args.member_id ? { ...submission, ...recorded } : submission));
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

const openPermit = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/services/permits"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/services/permits" element={<PermitsScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByText("Market Stall Permit"));
  await screen.findByText("Not sent yet");
};

const rowOf = (name: string) => screen.findByRole("button", { name: new RegExp(name) });

const openApplicationOf = async (name: string) => {
  await userEvent.click(await rowOf(name));
  await screen.findByText("Stall location");
};

const inspectCalls = () => called.mock.calls.filter(([, name]) => name === "forms_submission_inspect");

const listCalls = () => called.mock.calls.filter(([, name]) => name === "forms_submission_list");

const choose = (words: string) => userEvent.click(screen.getByRole("radio", { name: words }));

const record = () => userEvent.click(screen.getByRole("button", { name: "Record" }));

describe("the inspector's form in Applications received", () => {
  it("offers Inspection with the three results, a Note field and Record to a caller who holds application.inspect", async () => {
    await openPermit();

    await openApplicationOf("Bence Farkas");

    expect(screen.getByText("Inspection")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Complies" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Does not comply" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Needs more" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record" })).toBeInTheDocument();
  });

  it("records Complies with no note and asks for none", async () => {
    await openPermit();
    await openApplicationOf("Bence Farkas");

    await choose("Complies");
    await record();

    await waitFor(() => expect(inspectCalls()).toHaveLength(1));
    const [, , args] = inspectCalls()[0];
    expect(args).toMatchObject({ form_id: "f1", member_id: "m1", result: "complies" });
    expect((args as Args).note ?? "").toBe("");
  });

  it.each(["Does not comply", "Needs more"])("sends nothing for %s while the note is empty", async (words) => {
    await openPermit();
    await openApplicationOf("Bence Farkas");

    await choose(words);
    await record();

    expect(inspectCalls()).toHaveLength(0);
  });

  it.each([
    ["Does not comply", "does_not_comply", "The gate opens onto the road"],
    ["Needs more", "needs_more", "A site plan is missing"],
  ])("records %s with the note typed", async (words, result, note) => {
    await openPermit();
    await openApplicationOf("Bence Farkas");

    await choose(words);
    await userEvent.type(screen.getByRole("textbox", { name: "Note" }), note);
    await record();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_inspect", { form_id: "f1", member_id: "m1", result, note }));
  });

  it("reads the list again after recording and then shows the finding on the row", async () => {
    await openPermit();
    await openApplicationOf("Bence Farkas");
    const listedBefore = listCalls().length;

    await choose("Needs more");
    await userEvent.type(screen.getByRole("textbox", { name: "Note" }), "A photograph of the gate is needed");
    await record();

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(listedBefore));
    await waitFor(async () => expect(await screen.findByText(/A photograph of the gate is needed/)).toHaveTextContent("Needs more"));
  });

  it("offers no form to a caller without application.inspect but still reads an existing finding", async () => {
    permissions = councilPermissions;
    await openPermit();

    await openApplicationOf("Réka Tóth");

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
    expect(await screen.findByText("Inspection")).toBeInTheDocument();
    expect(screen.getByText(/Fence measured at 2.4 m/)).toHaveTextContent("Does not comply");
  });

  it("does not offer the form on the caller's own row", async () => {
    answers.actor_get_my_actor = () => ({ id: "m1" });
    await openPermit();

    await openApplicationOf("Bence Farkas");

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
  });

  it.each([
    ["complies", "Complies"],
    ["does_not_comply", "Does not comply"],
    ["needs_more", "Needs more"],
  ])("shows an Inspection line with %s, the day and the note on a row that carries a finding", async (result, words) => {
    permissions = councilPermissions;
    submissions = submissions.map((submission) => (submission.member_id === "m2" ? { ...submission, inspection_result: result } : submission));
    await openPermit();

    await openApplicationOf("Réka Tóth");

    expect(await screen.findByText("Inspection")).toBeInTheDocument();
    const line = screen.getByText(/Fence measured at 2.4 m/);
    expect(line).toHaveTextContent(words);
    expect(line).toHaveTextContent(dayWords(inspectedOn));
  });

  it("shows no Inspection text at all on a row with no finding when the caller may not inspect", async () => {
    permissions = councilPermissions;
    await openPermit();

    await openApplicationOf("Bence Farkas");

    expect(screen.queryByText("Inspection")).toBeNull();
    expect(screen.queryByText(/Complies|Does not comply|Needs more/)).toBeNull();
  });
});

describe("an application's page shows the finding on it", () => {
  const sent = { id: "s9", form_id: "f9", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z" };

  const answerWith = (send: Record<string, unknown>) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
      if (name === "agency_get_my_roles") return { permissions: [] };
      if (name === "forms_submission_read_mine") return { ...sent, ...send };
      if (name === "forms_question_list") return { items: [{ id: "q1", prompt: "Fence height" }] };
      if (name === "forms_answer_list") return { items: [{ id: "a1", question_id: "q1", member_id: "m1", value_text: "Two metres" }] };
      throw new Error(`${name} is not a tool this screen may use`);
    });

  const openApplication = () =>
    render(
      <MemoryRouter initialEntries={["/a/town/menu/services/applications/f9"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/services/applications/:id" element={<ApplicationScreen />} />
        </Routes>
      </MemoryRouter>,
    );

  it.each(Object.entries(resultWords))("reads a read-only Inspection row with %s, the day and the note", async (result, words) => {
    vi.restoreAllMocks();
    answerWith({ ...finding, inspection_result: result });
    openApplication();

    expect(await screen.findByText("Inspection")).toBeInTheDocument();
    const line = screen.getByText(/Fence measured at 2.4 m/);
    expect(line).toHaveTextContent(words);
    expect(line).toHaveTextContent(dayWords(inspectedOn));
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
  });

  it("shows no Inspection row when the application has no finding", async () => {
    vi.restoreAllMocks();
    answerWith({ inspection_result: "", inspected_by: "", inspected_at: "", inspection_note: "" });
    openApplication();

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    await screen.findByText("Two metres");
    expect(screen.queryByText("Inspection")).toBeNull();
  });
});
