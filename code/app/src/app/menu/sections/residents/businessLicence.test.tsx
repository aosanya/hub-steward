import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { servedAsHub } from "../../registerHub.test-support";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;
type Row = Record<string, unknown>;

const business = (id: string, name: string, kind: string, neighbourhood: string, replaces?: string): Row => ({
  id,
  answers: { "Trading name": name, "Kind of business": kind, Neighbourhood: neighbourhood },
  ...(replaces ? { replaces } : {}),
});

const bakery = business("b1", "Malomsor Bakery", "Bakery", "Malomsor");
const grocer = business("b2", "Zöldkert Grocer", "Grocer", "Óváros");
const smithy = business("b3", "Határrét Smithy", "Smithy", "Határrét");

const licenceEntry = { slug: "trading-licence", name: "Trading Licence", kind: "licence", form_id: "f-licence" };
const permitEntry = { slug: "market-stall-permit", name: "Market Stall Permit", kind: "permit", form_id: "f-permit" };

const send = (id: string, formId: string, extra: Row = {}): Row => ({
  id,
  form_id: formId,
  member_id: `m-${id}`,
  submitted_at: "2026-03-04T12:00:00Z",
  ...extra,
});

const approvedFor = (id: string, rowId: string, formId = licenceEntry.form_id) =>
  send(id, formId, { record_row_id: rowId, decision: "approved", decided_at: "2026-03-09T12:00:00Z" });

let called: MockInstance<typeof mcp.callTool>;
let current: Row[];
let history: Row[];
let entries: Row[];
let sends: Row[];
let submissionsRefused: boolean;
let questions: Row[];
let answers: Row[];

const serve = () => {
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, name: string, args?: unknown) => {
    const given = (args ?? {}) as Args;
    if (name === "agency_list_live_record_rows") return { items: given.history ? history : current };
    if (name === "forms_catalog_entry_list_public") return { items: entries.filter((entry) => entry.kind === given.kind) };
    if (name === "forms_submission_list") {
      if (submissionsRefused) throw new Error("forms_submission_list: permission denied: form.results");
      return { items: sends.filter((one) => one.form_id === given.form_id).map((one) => ({ ...one, member_id: one.member_id ?? `m-${String(one.id)}` })) };
    }
    if (name === "forms_question_list") return { items: questions };
    if (name === "forms_answer_list_all") return { items: answers };
    return { items: [] };
  });
  servedAsHub(called);
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const showBusinesses = () =>
  render(
    <MemoryRouter initialEntries={[residentPaths.businesses.path()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const validUntil = (sendId: string, date: string): Row => ({ member_id: `m-${sendId}`, question_id: "q-valid", value_date: date });

const rowOf = (title: string) => {
  const list = document.querySelector(".mw-list") as HTMLElement;
  const row = within(list).getByText(title).closest(".row") as HTMLElement;
  return within(row);
};

beforeEach(() => {
  openAgency("town");
  current = [bakery, grocer];
  history = [];
  entries = [licenceEntry, permitEntry];
  sends = [];
  submissionsRefused = false;
  questions = [{ id: "q-valid", prompt: "Valid until" }];
  answers = [];
  serve();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

describe("the licence mark on a row of the Businesses list", () => {
  it("at phone width a business named by an approved licence send reads Licensed and one with no send reads Not licensed, both listed", async () => {
    setWide(false);
    sends = [approvedFor("s1", "b1")];
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    expect(screen.getByText("Zöldkert Grocer")).toBeInTheDocument();
    await waitFor(() => expect(rowOf("Malomsor Bakery").getByText("Licensed")).toBeInTheDocument());
    expect(rowOf("Zöldkert Grocer").getByText("Not licensed")).toBeInTheDocument();
    expect(rowOf("Malomsor Bakery").queryByText("Not licensed")).toBeNull();
    expect(rowOf("Zöldkert Grocer").queryByText("Licensed")).toBeNull();
  });

  it("a send that is refused, or has no decision yet, does not make the business Licensed", async () => {
    sends = [
      send("s1", licenceEntry.form_id, { record_row_id: "b1", decision: "refused", decided_at: "2026-03-09T12:00:00Z" }),
      send("s2", licenceEntry.form_id, { record_row_id: "b2" }),
    ];
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Not licensed")).toHaveLength(2));
    expect(screen.queryByText("Licensed")).toBeNull();
  });

  it("an approved send of a permit does not count, and the permit form is never read", async () => {
    sends = [approvedFor("s1", "b1", permitEntry.form_id)];
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Not licensed")).toHaveLength(2));
    expect(screen.queryByText("Licensed")).toBeNull();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_list_public", { kind: "licence" });
    const listedForms = called.mock.calls.filter(([, name]) => name === "forms_submission_list").map(([, , args]) => (args as Args).form_id);
    expect(listedForms).toContain(licenceEntry.form_id);
    expect(listedForms).not.toContain(permitEntry.form_id);
  });

  it("a corrected business reads Licensed when the approved send names the older row it replaced", async () => {
    const corrected = business("b2", "Malomsor Bakery", "Bakery", "Malomsor", "b1");
    current = [corrected, smithy];
    history = [bakery];
    sends = [approvedFor("s1", "b1")];
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    await waitFor(() => expect(rowOf("Malomsor Bakery").getByText("Licensed")).toBeInTheDocument());
    expect(rowOf("Határrét Smithy").getByText("Not licensed")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "agency_list_live_record_rows", expect.objectContaining({ history: true }));
  });

  it("a business saved before the link, whose send names no row or which has no send at all, reads Not licensed and is still listed", async () => {
    current = [bakery, grocer, smithy];
    sends = [approvedFor("s1", "b1"), send("s2", licenceEntry.form_id, { decision: "approved", decided_at: "2026-03-09T12:00:00Z" })];
    showBusinesses();

    expect(await screen.findByText("Zöldkert Grocer")).toBeInTheDocument();
    expect(screen.getByText("Határrét Smithy")).toBeInTheDocument();
    await waitFor(() => expect(rowOf("Malomsor Bakery").getByText("Licensed")).toBeInTheDocument());
    expect(rowOf("Zöldkert Grocer").getByText("Not licensed")).toBeInTheDocument();
    expect(rowOf("Határrét Smithy").getByText("Not licensed")).toBeInTheDocument();
    expect(screen.getAllByText("Licensed")).toHaveLength(1);
  });

  it("when the sends cannot be read for lack of form.results the businesses are still listed and no row claims Licensed or Not licensed", async () => {
    submissionsRefused = true;
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    expect(screen.getByText("Zöldkert Grocer")).toBeInTheDocument();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_list", expect.objectContaining({ form_id: licenceEntry.form_id })));
    expect(screen.queryByText("Licensed")).toBeNull();
    expect(screen.queryByText("Not licensed")).toBeNull();
  });

  it("at computer width the marks are on the rows of the list beside the opened business", async () => {
    setWide(true);
    sends = [approvedFor("s1", "b1")];
    showBusinesses();

    await userEvent.click(await screen.findByRole("button", { name: /Malomsor Bakery/ }));

    await waitFor(() => expect(document.querySelector(".wf-main.mw-detail")).not.toBeNull());
    await waitFor(() => expect(rowOf("Malomsor Bakery").getByText("Licensed")).toBeInTheDocument());
    expect(rowOf("Zöldkert Grocer").getByText("Not licensed")).toBeInTheDocument();
    const list = document.querySelector(".mw-list") as HTMLElement;
    expect(list.classList.contains("wf-tree")).toBe(true);
  });
});

describe("the Expired mark on a row of the Businesses list", () => {
  it("a business whose approved licence ran out before today reads Expired and one valid until a later date reads Licensed", async () => {
    current = [bakery, grocer, smithy];
    sends = [approvedFor("s1", "b1"), approvedFor("s2", "b2")];
    answers = [validUntil("s1", "2020-01-31"), validUntil("s2", "2999-12-31")];
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    await waitFor(() => expect(rowOf("Malomsor Bakery").getByText("Expired")).toBeInTheDocument());
    expect(rowOf("Malomsor Bakery").queryByText("Licensed")).toBeNull();
    expect(rowOf("Zöldkert Grocer").getByText("Licensed")).toBeInTheDocument();
    expect(rowOf("Határrét Smithy").getByText("Not licensed")).toBeInTheDocument();
  });

  it("a licence with no valid-until answer still reads Licensed", async () => {
    sends = [approvedFor("s1", "b1")];
    showBusinesses();

    expect(await screen.findByText("Malomsor Bakery")).toBeInTheDocument();
    await waitFor(() => expect(rowOf("Malomsor Bakery").getByText("Licensed")).toBeInTheDocument());
    expect(screen.queryByText("Expired")).toBeNull();
  });
});
