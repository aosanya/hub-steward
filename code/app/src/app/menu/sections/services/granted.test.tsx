import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  { id: "m4", display_name: "Zsófia Nagy" },
];

const questions = [
  { id: "q1", prompt: "Stall location" },
  { id: "q2", prompt: "Number of trading days" },
];

const answersOf = (memberId: string) => [
  { id: `a1-${memberId}`, question_id: "q1", member_id: memberId, value_text: "Mill Lane" },
  { id: `a2-${memberId}`, question_id: "q2", member_id: memberId, value_text: "Five" },
];

const freshSubmissions = () => [
  { id: "s1", form_id: "f1", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z", paid: false, decision: "approved", decided_by: "m9", decided_at: "2026-03-12T12:00:00Z", decision_note: "" },
  { id: "s2", form_id: "f1", member_id: "m2", submitted_at: "2026-03-02T12:00:00Z", paid: false, decision: "approved", decided_by: "m9", decided_at: "2026-03-09T12:00:00Z", decision_note: "" },
  { id: "s3", form_id: "f1", member_id: "m3", submitted_at: "2026-03-03T12:00:00Z", paid: false, decision: "refused", decided_by: "m9", decided_at: "2026-03-10T12:00:00Z", decision_note: "Too close to the fountain" },
  { id: "s4", form_id: "f1", member_id: "m4", submitted_at: "2026-03-05T12:00:00Z", paid: false },
];

const sentAndRefusedOnly = () => freshSubmissions().filter((submission) => submission.member_id === "m3" || submission.member_id === "m4");

const ownSend = (extra: Record<string, unknown>) => [{ id: "o1", form_id: "f1", member_id: "m5", submitted_at: "2026-03-04T12:00:00Z", paid: false, ...extra }];

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
    forms_catalog_entry_list_public: (args) => ({ items: entries.filter((entry) => entry.kind === args.kind) }),
    forms_catalog_entry_read: (args) => ({ item: entries.find((entry) => entry.slug === args.slug) }),
    forms_catalog_entry_submissions_mine: () => ownSends,
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

const openEntryWithOwnSend = async () => {
  await clickEntry("permit");
  await screen.findByText("Sent on");
};

const grantedList = () => screen.queryByRole("region", { name: "Granted" }) as HTMLElement | null;

const rowButtons = (card: HTMLElement) => within(card).queryAllByRole("button").filter((button) => button.getAttribute("aria-label") !== "Collapse");

const grantedWith = async (words: string) => {
  await screen.findByRole("region", { name: "Granted" });
  await waitFor(() => expect(grantedList()).toHaveTextContent(words));
  return grantedList() as HTMLElement;
};

const rowOf = (name: string) => screen.findByRole("button", { name: new RegExp(name) });

describe("The status of the person's own send on a permit", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("reads Approved on a send that was approved", async () => {
    ownSends = ownSend({ decision: "approved", decided_at: "2026-03-09T12:00:00Z" });
    await openEntryWithOwnSend();

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByText("Sent")).toBeNull();
  });

  it("reads Refused on a send that was refused", async () => {
    ownSends = ownSend({ decision: "refused", decided_at: "2026-03-10T12:00:00Z" });
    await openEntryWithOwnSend();

    expect(screen.getByText("Refused")).toBeInTheDocument();
    expect(screen.queryByText("Sent")).toBeNull();
  });

  it("reads Withdrawn on a withdrawn send even when it also has a decision", async () => {
    ownSends = ownSend({ withdrawn_at: "2026-03-11T12:00:00Z", decision: "approved", decided_at: "2026-03-09T12:00:00Z" });
    await openEntryWithOwnSend();

    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.queryByText("Approved")).toBeNull();
  });

  it("still reads Sent on a send nobody has decided", async () => {
    ownSends = ownSend({});
    await openEntryWithOwnSend();

    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.queryByText("Approved")).toBeNull();
    expect(screen.queryByText("Refused")).toBeNull();
  });
});

describe("The Granted section on a permit or licence entry", () => {
  it.each([
    ["permit", "f1"],
    ["licence", "f3"],
  ] as const)("shows the section Granted on a %s entry to a caller who may decide, read results and read answers", async (kind, formId) => {
    submissions = submissions.map((submission) => ({ ...submission, form_id: formId }));
    await openEntry(kind);

    expect(await screen.findByRole("region", { name: "Granted" })).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_submission_list", { form_id: formId });
  });

  it("shows the section Granted to a caller who holds only form.results", async () => {
    permissions = ["form.results"];
    await openEntry();

    const section = await grantedWith("Réka Tóth");

    expect(section).toHaveTextContent("Bence Farkas");
    expect(screen.queryByText("Applications received")).toBeNull();
  });

  it("lists only the people whose send was approved, with the applicant's name and never the member id", async () => {
    await openEntry();

    const section = await grantedWith("Réka Tóth");

    expect(section).toHaveTextContent("Bence Farkas");
    expect(section).not.toHaveTextContent("Dániel Kiss");
    expect(section).not.toHaveTextContent("Zsófia Nagy");
    expect(section.textContent).not.toMatch(/\bm[1-9]\b/);
  });

  it("gives each person the day the permit was decided, not the day it was sent", async () => {
    await openEntry();

    const section = await grantedWith("Réka Tóth");

    expect(within(section).getByText("Thursday, 12 Mar")).toBeInTheDocument();
    expect(within(section).getByText("Monday, 9 Mar")).toBeInTheDocument();
    expect(section).not.toHaveTextContent("Wednesday, 4 Mar");
    expect(section).not.toHaveTextContent("Monday, 2 Mar");
  });

  it("lists the newest decision first", async () => {
    await openEntry();

    const section = await grantedWith("Réka Tóth");
    const words = section.textContent ?? "";

    expect(words.indexOf("Bence Farkas")).toBeGreaterThanOrEqual(0);
    expect(words.indexOf("Bence Farkas")).toBeLessThan(words.indexOf("Réka Tóth"));
  });

  it("puts a person who was refused or has not been decided under Applications received only", async () => {
    await openEntry();
    const section = await grantedWith("Réka Tóth");

    expect(await rowOf("Dániel Kiss")).toBeInTheDocument();
    expect(await rowOf("Zsófia Nagy")).toBeInTheDocument();
    expect(within(section).queryByText("Dániel Kiss")).toBeNull();
    expect(within(section).queryByText("Zsófia Nagy")).toBeNull();
  });

  it("shows an empty card with No one has been granted this yet. when only refused and undecided sends exist", async () => {
    submissions = sentAndRefusedOnly();
    await openEntry();

    await screen.findByRole("region", { name: "Granted" });
    await waitFor(() => expect(grantedList()).toHaveTextContent("No one has been granted this yet."));
    const card = grantedList() as HTMLElement;

    expect(card).toHaveTextContent(/^GrantedNo one has been granted this yet\.$/);
    expect(rowButtons(card)).toHaveLength(0);
  });

  it("shows an empty card with No one has been granted this yet. when nobody has sent anything", async () => {
    submissions = [];
    await openEntry();

    await screen.findByRole("region", { name: "Granted" });
    await waitFor(() => expect(grantedList()).toHaveTextContent("No one has been granted this yet."));
    const card = grantedList() as HTMLElement;

    expect(card).toHaveTextContent(/^GrantedNo one has been granted this yet\.$/);
    expect(rowButtons(card)).toHaveLength(0);
  });

  it("shows no Granted section and never lists submissions to a caller without form.results", async () => {
    permissions = ["application.decide", "form.answers.read"];
    await openEntry();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("region", { name: "Granted" })).toBeNull();
    expect(screen.queryByText("No one has been granted this yet.")).toBeNull();
    expect(called).not.toHaveBeenCalledWith("", "forms_submission_list", expect.anything());
  });

  it("shows no Granted section on a fee entry even to a caller who may decide", async () => {
    await openEntry("fee");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_submissions_mine", { slug: "hall-hire-fee" }));

    expect(screen.queryByRole("region", { name: "Granted" })).toBeNull();
    expect(screen.queryByText("No one has been granted this yet.")).toBeNull();
  });

  it("tags each person with Licensed while the permit runs and Expired once it has run out, and says until when", async () => {
    submissions = submissions.map((submission) =>
      submission.member_id === "m1" ? { ...submission, valid_until: "2999-12-31T00:00:00Z" } : submission.member_id === "m2" ? { ...submission, valid_until: "2020-01-31T00:00:00Z" } : submission,
    );
    await openEntry();

    const section = await grantedWith("Réka Tóth");
    const first = within(within(section).getByText("Bence Farkas").closest(".row") as HTMLElement);
    const second = within(within(section).getByText("Réka Tóth").closest(".row") as HTMLElement);

    expect(first.getByText("Licensed")).toHaveClass("success");
    expect(first.getByText(/^Valid until/)).toBeInTheDocument();
    expect(second.getByText("Expired")).toHaveClass("danger");
    expect(second.getByText(/^Valid until/)).toBeInTheDocument();
  });

  it("writes the year on an end day that is not in the current year", async () => {
    submissions = submissions.map((submission) =>
      submission.member_id === "m1" ? { ...submission, valid_until: "2999-12-31T00:00:00Z" } : submission.member_id === "m2" ? { ...submission, valid_until: "2020-01-31T00:00:00Z" } : submission,
    );
    await openEntry();

    const section = await grantedWith("Réka Tóth");

    expect(within(section).getByText(/Valid until Tuesday, 31 Dec 2999/)).toBeInTheDocument();
    expect(within(section).getByText(/Valid until Friday, 31 Jan 2020/)).toBeInTheDocument();
  });

  it("keeps every granted row inside the Granted card, as media rows with no loose caption above them", async () => {
    await openEntry();

    const section = await grantedWith("Réka Tóth");

    expect(section.tagName).toBe("SECTION");
    expect(section.querySelectorAll(".row .lead").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("heading", { name: "Granted" })).toBeNull();
  });

  it("shows a person under Granted with the day of the decision once Grant is pressed on their row", async () => {
    await openEntry();
    const before = await grantedWith("Réka Tóth");
    expect(before).not.toHaveTextContent("Zsófia Nagy");

    await userEvent.click(await rowOf("Zsófia Nagy"));
    await screen.findByText("Stall location");
    await userEvent.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_decide", { form_id: "f1", member_id: "m4", decision: "approved", note: "" }));
    await waitFor(() => expect(grantedList()).toHaveTextContent("Zsófia Nagy"));
    expect(within(grantedList() as HTMLElement).getByText("Tuesday, 17 Mar")).toBeInTheDocument();
  });
});
