import { vi, type MockInstance } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { dayWords } from "../../../../shared/ui/days";
import { ApplicationScreen } from "./ApplicationScreen";
import { LicencesScreen, PermitsScreen } from "./ServicesScreens";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const deciderPermissions = ["application.decide", "form.results", "form.answers.read"];

const certificateRef = "PRM-2026-0417";

const endsOn = "2099-12-31";

const endsWords = dayWords(endsOn);

const entries = [
  { id: "e1", slug: "market-stall-permit", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1" },
  { id: "e3", slug: "dog-licence", name: "Dog Licence", summary: "Keep a dog in town", kind: "licence", form_id: "f3" },
];

const people = [
  { id: "m1", display_name: "Bence Farkas" },
  { id: "m2", display_name: "Réka Tóth" },
  { id: "m4", display_name: "Zsófia Nagy" },
];

const questions = [{ id: "q1", prompt: "Stall location" }];

const answersOf = (memberId: string) => [{ id: `a1-${memberId}`, question_id: "q1", member_id: memberId, value_text: "Mill Lane" }];

const freshSubmissions = () => [
  { id: "s1", form_id: "f1", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z", paid: false, decision: "approved", decided_by: "m9", decided_at: "2026-03-12T12:00:00Z", decision_note: "", certificate_ref: certificateRef, valid_until: endsOn },
  { id: "s2", form_id: "f1", member_id: "m2", submitted_at: "2026-03-02T12:00:00Z", paid: false, decision: "approved", decided_by: "m9", decided_at: "2026-03-09T12:00:00Z", decision_note: "" },
  { id: "s4", form_id: "f1", member_id: "m4", submitted_at: "2026-03-05T12:00:00Z", paid: false },
];

const ownSend = (extra: Record<string, unknown>) => [{ id: "o1", form_id: "f1", member_id: "m5", submitted_at: "2026-03-04T12:00:00Z", paid: false, decision: "approved", decided_by: "m9", decided_at: "2026-03-09T12:00:00Z", ...extra }];

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let submissions: Record<string, unknown>[];
let ownSends: Record<string, unknown>[];
let answers: Record<string, (args: Args) => unknown>;

beforeEach(() => {
  openAgency("town");
  permissions = deciderPermissions;
  submissions = freshSubmissions();
  ownSends = [];
  answers = {
    agency_get_my_roles: () => ({ permissions }),
    actor_get_my_actor: () => ({ id: "m9" }),
    forms_catalog_entry_list_public: (args) => ({ items: entries.filter((entry) => entry.kind === args.kind) }),
    forms_catalog_entry_read: (args) => ({ item: entries.find((entry) => entry.slug === args.slug) }),
    forms_catalog_entry_submissions_mine: () => ownSends,
    forms_submission_list: (args) => ({ items: submissions.filter((submission) => submission.form_id === args.form_id) }),
    actor_list_actors: () => ({ items: people }),
    forms_question_list: () => ({ items: questions }),
    forms_answer_list_all: (args) => ({ items: answersOf(String(args.member_id)) }),
    forms_submission_decide: (args) => {
      const decided = { decision: args.decision, decided_by: "m9", decided_at: "2026-03-17T12:00:00Z", decision_note: args.note, certificate_ref: args.certificate_ref, valid_until: args.valid_until };
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
};

const clickEntry = async (kind: keyof typeof screens) => {
  const { at, pattern, Screen, entry } = screens[kind];
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path={pattern} element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByText(entry));
};

const openEntry = async (kind: keyof typeof screens = "permit") => {
  await clickEntry(kind);
  await screen.findByText("Not sent yet");
};

const openEntryWithOwnSend = async (kind: keyof typeof screens = "permit") => {
  await clickEntry(kind);
  await screen.findByText("Sent on");
};

const rowOf = (name: string) => screen.findByRole("button", { name: new RegExp(name) });

const decideCalls = () => called.mock.calls.filter(([, name]) => name === "forms_submission_decide");

const openUndecidedApplication = async () => {
  await openEntry();
  await userEvent.click(await rowOf("Zsófia Nagy"));
  await screen.findByText("Stall location");
};

const typeCertificate = (words: string) => userEvent.type(screen.getByLabelText("Certificate"), words);

const chooseEndDay = (day: string) => fireEvent.change(screen.getByLabelText("Valid until"), { target: { value: day } });

const grant = () => userEvent.click(screen.getByRole("button", { name: "Grant" }));

const grantedList = () => screen.queryByRole("heading", { name: "Granted" })?.nextElementSibling as HTMLElement | undefined;

const grantedWith = async (words: string) => {
  await screen.findByRole("heading", { name: "Granted" });
  await waitFor(() => expect(grantedList()).toHaveTextContent(words));
  return grantedList() as HTMLElement;
};

describe("the Grant action of Applications received", () => {
  it("offers a Certificate input and a Valid until input beside Grant on an undecided application", async () => {
    await openUndecidedApplication();

    expect(screen.getByLabelText("Certificate")).toBeInTheDocument();
    expect(screen.getByLabelText("Valid until")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant" })).toBeInTheDocument();
  });

  it("sends certificate_ref and valid_until with the grant when both are filled", async () => {
    await openUndecidedApplication();

    await typeCertificate(certificateRef);
    chooseEndDay(endsOn);
    await grant();

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "forms_submission_decide", { form_id: "f1", member_id: "m4", decision: "approved", note: "", certificate_ref: certificateRef, valid_until: endsOn }),
    );
  });

  it("sends only certificate_ref when only the certificate is filled", async () => {
    await openUndecidedApplication();

    await typeCertificate(certificateRef);
    await grant();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_decide", { form_id: "f1", member_id: "m4", decision: "approved", note: "", certificate_ref: certificateRef }));
  });

  it("sends only valid_until when only the end day is filled", async () => {
    await openUndecidedApplication();

    chooseEndDay(endsOn);
    await grant();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_decide", { form_id: "f1", member_id: "m4", decision: "approved", note: "", valid_until: endsOn }));
  });

  it("sends neither key when both inputs are left blank", async () => {
    await openUndecidedApplication();

    await grant();

    await waitFor(() => expect(decideCalls()).toHaveLength(1));
    expect(decideCalls()[0][2]).toStrictEqual({ form_id: "f1", member_id: "m4", decision: "approved", note: "" });
  });

  it("sends no certificate_ref when the certificate holds only spaces", async () => {
    await openUndecidedApplication();

    await typeCertificate("   ");
    await grant();

    await waitFor(() => expect(decideCalls()).toHaveLength(1));
    expect(decideCalls()[0][2]).toStrictEqual({ form_id: "f1", member_id: "m4", decision: "approved", note: "" });
  });

  it("sends no certificate_ref and no valid_until with a refusal even when they were filled in", async () => {
    await openUndecidedApplication();

    await typeCertificate(certificateRef);
    chooseEndDay(endsOn);
    await userEvent.click(screen.getByRole("button", { name: "Refuse" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Reason" }), "The plan is missing");
    await userEvent.click(screen.getByRole("button", { name: "Refuse" }));

    await waitFor(() => expect(decideCalls()).toHaveLength(1));
    expect(decideCalls()[0][2]).toStrictEqual({ form_id: "f1", member_id: "m4", decision: "refused", note: "The plan is missing" });
  });

  it("offers neither input on an application that is already decided", async () => {
    await openEntry();

    await userEvent.click(await rowOf("Réka Tóth"));
    await screen.findByText("Stall location");

    expect(screen.queryByLabelText("Certificate")).toBeNull();
    expect(screen.queryByLabelText("Valid until")).toBeNull();
  });
});

describe("an application's page shows the certificate and the day it ends", () => {
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

  const granted = { decision: "approved", decided_by: "Ilona Varga", decided_at: "2026-03-10T12:00:00Z" };

  it("reads a Certificate row and a Valid until row with the day when the send carries them", async () => {
    vi.restoreAllMocks();
    answerWith({ ...granted, certificate_ref: certificateRef, valid_until: endsOn });
    openApplication();

    expect(await screen.findByText("Certificate")).toBeInTheDocument();
    expect(screen.getByText(certificateRef)).toBeInTheDocument();
    expect(screen.getByText("Valid until")).toBeInTheDocument();
    expect(screen.getByText(endsWords)).toBeInTheDocument();
  });

  it("reads only the Certificate row when the send carries no end day", async () => {
    vi.restoreAllMocks();
    answerWith({ ...granted, certificate_ref: certificateRef });
    openApplication();

    expect(await screen.findByText("Certificate")).toBeInTheDocument();
    expect(screen.getByText(certificateRef)).toBeInTheDocument();
    expect(screen.queryByText("Valid until")).toBeNull();
  });

  it("reads only the Valid until row when the send carries no certificate", async () => {
    vi.restoreAllMocks();
    answerWith({ ...granted, valid_until: endsOn });
    openApplication();

    expect(await screen.findByText("Valid until")).toBeInTheDocument();
    expect(screen.getByText(endsWords)).toBeInTheDocument();
    expect(screen.queryByText("Certificate")).toBeNull();
  });

  it("shows neither row on a grant that carries neither", async () => {
    vi.restoreAllMocks();
    answerWith(granted);
    openApplication();

    expect(await screen.findByText("Approved")).toBeInTheDocument();
    await screen.findByText("Two metres");
    expect(screen.queryByText("Certificate")).toBeNull();
    expect(screen.queryByText("Valid until")).toBeNull();
  });

  it("shows neither row on an application nobody has decided", async () => {
    vi.restoreAllMocks();
    answerWith({});
    openApplication();

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    await screen.findByText("Two metres");
    expect(screen.queryByText("Certificate")).toBeNull();
    expect(screen.queryByText("Valid until")).toBeNull();
  });
});

describe("the opened permit or licence shows the holder's certificate and the day it ends", () => {
  beforeEach(() => {
    permissions = [];
  });

  it.each([
    ["permit", "f1"],
    ["licence", "f3"],
  ] as const)("reads a Certificate row and a Valid until row on a %s whose send carries them", async (kind, formId) => {
    ownSends = ownSend({ form_id: formId, certificate_ref: certificateRef, valid_until: endsOn });
    await openEntryWithOwnSend(kind);

    expect(await screen.findByText("Certificate")).toBeInTheDocument();
    expect(screen.getByText(certificateRef)).toBeInTheDocument();
    expect(screen.getByText("Valid until")).toBeInTheDocument();
    expect(screen.getByText(endsWords)).toBeInTheDocument();
  });

  it("reads only the Certificate row when the send carries no end day", async () => {
    ownSends = ownSend({ certificate_ref: certificateRef });
    await openEntryWithOwnSend();

    expect(await screen.findByText("Certificate")).toBeInTheDocument();
    expect(screen.queryByText("Valid until")).toBeNull();
  });

  it("reads only the Valid until row when the send carries no certificate", async () => {
    ownSends = ownSend({ valid_until: endsOn });
    await openEntryWithOwnSend();

    expect(await screen.findByText("Valid until")).toBeInTheDocument();
    expect(screen.queryByText("Certificate")).toBeNull();
  });

  it("shows neither row on a grant that carries neither", async () => {
    ownSends = ownSend({});
    await openEntryWithOwnSend();

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByText("Certificate")).toBeNull();
    expect(screen.queryByText("Valid until")).toBeNull();
  });
});

describe("the Granted section shows the day the grant ends", () => {
  it("gives a granted person who has an end day that day beside the day it was decided", async () => {
    await openEntry();

    const section = await grantedWith("Bence Farkas");

    expect(section).toHaveTextContent(endsWords);
    expect(section).toHaveTextContent(dayWords("2026-03-12T12:00:00Z"));
  });

  it("shows an end day only on the row that has one", async () => {
    await openEntry();

    const section = await grantedWith("Réka Tóth");

    expect(section).toHaveTextContent(dayWords("2026-03-09T12:00:00Z"));
    expect(within(section).getAllByText(endsWords)).toHaveLength(1);
  });

  it("shows nothing extra on a granted row with no end day", async () => {
    submissions = submissions.filter((submission) => submission.member_id === "m2");
    await openEntry();

    const section = await grantedWith("Réka Tóth");

    expect(section).toHaveTextContent(/^Réka TóthMonday, 9 Mar$/);
  });
});
