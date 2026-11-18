import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { RecordApplications } from "./RecordLinks";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = { id: string; answers: Record<string, string> };
type Person = Record<string, unknown>;

const ownerId = "a7c1e3d2-4f90-4b1a-9c55-0e2d6f31b8aa";
const otherOwnerId = "c3d9f0a1-77e2-4d08-8a4b-5b1e9c20d4ee";
const personName = "Sample Resident A";

type Kind = { name: string; code: string; path: () => string; heading: string; ownerPrompt: string; titlePrompt: string; owned: Row; other: Row; unowned: Row; sameName: Row };

const kinds: Kind[] = [
  {
    name: "business",
    code: "RC-1",
    path: () => residentPaths.businesses.path(),
    heading: "Owner",
    ownerPrompt: "Owner",
    titlePrompt: "Trading name",
    owned: { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Neighbourhood: "Malomsor", Status: "Active", Owner: ownerId } },
    other: { id: "b2", answers: { "Trading name": "Zöldkert Grocer", "Kind of business": "Grocer", "Tax number": "20000000-2-02", Neighbourhood: "Óváros", Status: "Suspended", Owner: otherOwnerId } },
    unowned: { id: "b3", answers: { "Trading name": "Zöldhalom Florist", "Kind of business": "Florist", "Tax number": "30000000-3-03", Neighbourhood: "Kertváros", Status: "Active" } },
    sameName: { id: "b4", answers: { "Trading name": personName, "Kind of business": "Tailor", "Tax number": "40000000-4-04", Neighbourhood: "Határrét", Status: "Active" } },
  },
  {
    name: "informal trader",
    code: "RC-2",
    path: () => residentPaths.informalTraders.path(),
    heading: "Holder",
    ownerPrompt: "Holder",
    titlePrompt: "Name or alias",
    owned: { id: "t1", answers: { "Name or alias": "Flower Corner", "What is sold": "Flowers", "Usual place": "Market square", "Usual days": "Saturday", Neighbourhood: "Kertváros", Status: "Active", Holder: ownerId } },
    other: { id: "t2", answers: { "Name or alias": "Chestnut Roaster", "What is sold": "Roasted chestnuts", "Usual place": "Station steps", Neighbourhood: "Határrét", Status: "Suspended", Holder: otherOwnerId } },
    unowned: { id: "t3", answers: { "Name or alias": "Zöldhalom Honey Stall", "What is sold": "Honey", "Usual place": "Mill street", Neighbourhood: "Óváros", Status: "Active" } },
    sameName: { id: "t4", answers: { "Name or alias": personName, "What is sold": "Herbs", "Usual place": "Town gate", Neighbourhood: "Malomsor", Status: "Active" } },
  },
];

const widths = [
  { name: "a phone page", wide: false, pane: ".mw-detail" },
  { name: "the wide pane", wide: true, pane: ".wf .wf-main .wf-content" },
];

const unlinkedTools = [
  "forms_submission_list",
  "forms_catalog_booking_list_of_person",
];

let called: MockInstance<typeof mcp.callTool>;
let rowsByCode: Record<string, Row[]>;
let actorReply: () => Promise<unknown>;
let billsByRow: Record<string, Person[]>;
let paymentsByRow: Record<string, Person[]>;
let billsReply: (() => Promise<unknown>) | null;
let paymentsReply: (() => Promise<unknown>) | null;
let holdingsByRow: Record<string, Person[]>;
let holdingsReply: (() => Promise<unknown>) | null;
let applicationsByRow: Record<string, Person[]>;

const actorCalls = () => called.mock.calls.filter((call) => call[1] === "actor_get_actor");

const withoutOwnerPrompt = (row: Row, prompt: string): Row => ({ id: row.id, answers: Object.fromEntries(Object.entries(row.answers).filter(([key]) => key !== prompt)) });

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_live_record_rows") return { items: rowsByCode[String(given.record_code)] ?? [] };
  if (name === "actor_get_actor") return actorReply();
  if (name === "actor_list_actors") return { items: [{ id: ownerId, display_name: personName, status: "active" }] };
  if (name === "accounting_bill_list") return billsReply ? billsReply() : { items: billsByRow[String(given.record_row_id)] ?? [] };
  if (name === "accounting_payment_list") return paymentsReply ? paymentsReply() : { items: paymentsByRow[String(given.record_row_id)] ?? [] };
  if (name === "digitaltwin_tenure_list") return holdingsReply ? holdingsReply() : { items: holdingsByRow[String(given.holder_record_row_id)] ?? [] };
  if (name === "forms_submission_list_of_person") return { items: applicationsByRow[String(given.record_row_id)] ?? [] };
  if (name === "digitaltwin_node_list") return { items: [{ id: "stall1", name: "Stall 4, Market square" }] };
  return { items: [] };
};

const showScreen = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  actorReply = async () => ({ id: ownerId, display_name: personName, status: "active" });
  billsByRow = {};
  paymentsByRow = {};
  billsReply = null;
  paymentsReply = null;
  holdingsByRow = {};
  holdingsReply = null;
  applicationsByRow = {};
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe.each(kinds)("an opened $name ($code)", (kind) => {
  describe.each(widths)("on $name", (view) => {
    const setUp = (rows: Row[]) => {
      setWide(view.wide);
      rowsByCode = { [kind.code]: rows };
    };

    const openRow = async (row: Row) => {
      showScreen(kind.path());
      await userEvent.click(await screen.findByText(row.answers[kind.titlePrompt], { selector: ".ttl" }));
      const pane = () => document.querySelector(view.pane) as HTMLElement;
      const firstField = Object.entries(row.answers).find(([prompt]) => prompt !== kind.ownerPrompt) as [string, string];
      expect(await within(pane()).findByText(firstField[0])).toBeInTheDocument();
      return { pane, firstField };
    };

    it(`shows one ${kind.heading} section with one plain row with the person's name after the heading, no link, and never the raw id`, async () => {
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      const heading = await within(pane()).findByRole("heading", { name: kind.heading });
      const nameRow = await within(pane()).findByText(personName, { selector: ".ttl" });
      expect(within(pane()).getAllByRole("heading", { name: kind.heading })).toHaveLength(1);
      expect(within(pane()).getAllByText(personName)).toHaveLength(1);
      expect(heading.compareDocumentPosition(nameRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(nameRow.closest(".row")).not.toBeNull();
      expect(within(pane()).queryByRole("link")).toBeNull();
      expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: ownerId });
      expect(document.body.textContent).not.toContain(ownerId);
      expect(document.body.textContent).not.toContain(otherOwnerId);
      expect(within(pane()).queryByText(kind.ownerPrompt, { selector: ".ttl" })).toBeNull();
      Object.values(kind.owned.answers)
        .filter((value) => value !== ownerId)
        .forEach((value) => expect(within(pane()).getByText(value)).toBeInTheDocument());
      const lastField = within(pane()).getByText(kind.owned.answers.Neighbourhood);
      expect(lastField.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("asks for the person once, by the id the row holds", async () => {
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await within(pane()).findByRole("heading", { name: kind.heading });
      expect(actorCalls()).toHaveLength(1);
      expect(actorCalls()[0][2]).toEqual({ actor_id: ownerId });
    });

    it.each([
      ["has no answer", (row: Row) => withoutOwnerPrompt(row, kind.ownerPrompt)],
      ["has a blank answer", (row: Row) => ({ id: row.id, answers: { ...row.answers, [kind.ownerPrompt]: "   " } })],
    ])(`shows no ${kind.heading} heading and does not ask for a person when the row %s`, async (_label, strip) => {
      const row = strip(kind.owned);
      setUp([row, kind.other]);
      const { pane } = await openRow(row);

      expect(within(pane()).queryByRole("heading", { name: kind.heading })).toBeNull();
      expect(within(pane()).queryByRole("link")).toBeNull();
      expect(actorCalls()).toHaveLength(0);
      expect(document.body.textContent).not.toContain(ownerId);
    });

    it.each([
      ["a refused reply", () => Promise.reject(new mcp.McpError("actor_get_actor: the hub refused this"))],
      ["an unserved tool", () => Promise.reject(new Error("actor_get_actor: unknown tool"))],
    ])(`shows no ${kind.heading} heading, no error, and still the record's own fields after %s`, async (_label, reply) => {
      actorReply = reply;
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await vi.waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: ownerId }));
      expect(within(pane()).queryByRole("heading", { name: kind.heading })).toBeNull();
      expect(within(pane()).queryByRole("link")).toBeNull();
      expect(within(pane()).queryByText(/could not be loaded|refused|unknown tool|not found|did not go through/i)).toBeNull();
      Object.values(kind.owned.answers)
        .filter((value) => value !== ownerId)
        .forEach((value) => expect(within(pane()).getByText(value)).toBeInTheDocument());
      expect(document.body.textContent).not.toContain(ownerId);
    });

    it.each([
      ["no name at all", { id: ownerId, status: "active" }],
      ["a blank display name", { id: ownerId, display_name: "   ", status: "active" }],
    ])(`shows no ${kind.heading} heading when the person comes back with %s`, async (_label, person: Person) => {
      actorReply = async () => person;
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await vi.waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: ownerId }));
      expect(within(pane()).queryByRole("heading", { name: kind.heading })).toBeNull();
      expect(within(pane()).queryByRole("link")).toBeNull();
      expect(document.body.textContent).not.toContain(ownerId);
    });

    it("links nothing for a row whose name equals an actor's display name but has no answer", async () => {
      setUp([kind.sameName, kind.owned]);
      const { pane } = await openRow(kind.sameName);

      expect(within(pane()).queryByRole("heading", { name: kind.heading })).toBeNull();
      expect(within(pane()).queryByRole("link")).toBeNull();
      expect(actorCalls()).toHaveLength(0);
      expect(called.mock.calls.filter((call) => call[1] === "actor_list_actors")).toHaveLength(0);
    });

    const permitSend = { id: "s1", form_id: "f1", form_title: "Sample Stall Permit", member_id: ownerId, submitted_at: "2026-11-03T09:30:00Z" };

    it("lists the applications of the opened row under Licences and permits, asked by the owner and the row, after the Holdings", async () => {
      applicationsByRow = { [kind.owned.id]: [permitSend] };
      holdingsByRow = { [kind.owned.id]: [{ id: "ten9", place_id: "stall1", holder: "Trading account", kind: "tenant", since: "2025-04-01" }] };
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      const heading = await within(pane()).findByRole("heading", { name: "Licences and permits" });
      expect(await within(pane()).findByText("Sample Stall Permit", { selector: ".ttl" })).toBeInTheDocument();
      const holdings = await within(pane()).findByRole("heading", { name: "Holdings" });
      expect(holdings.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(called).toHaveBeenCalledWith("", "forms_submission_list_of_person", { member_id: ownerId, record_row_id: kind.owned.id });
    });

    it("draws no Licences and permits heading and no empty card when the opened row has no applications", async () => {
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await vi.waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_list_of_person", { member_id: ownerId, record_row_id: kind.owned.id }));
      expect(within(pane()).queryByRole("heading", { name: "Licences and permits" })).toBeNull();
      expect(within(pane()).queryByText(/No .* yet|Start an application/i)).toBeNull();
    });

    it("lists no holdings, audit entries or bookings for the record", async () => {
      setUp([kind.owned, kind.unowned]);
      const { pane } = await openRow(kind.owned);

      await within(pane()).findByRole("heading", { name: kind.heading });
      const names = called.mock.calls.map((call) => call[1]);
      unlinkedTools.forEach((tool) => expect(names).not.toContain(tool));
      expect(within(pane()).queryByText(/permit|inspection|booking/i)).toBeNull();
    });

    const bill = { id: "bill1", payer: "Trading account", amount: 150000, due_at: "2026-03-01T00:00:00Z", status: "open" };
    const overdue = { id: "bill2", payer: "Trading account", amount: 42000, due_at: "2026-01-10T00:00:00Z", status: "overdue", days_overdue: 12 };
    const payment = { id: "pay1", kind: "bill", amount: 90000, paid_at: "2026-02-04T09:00:00Z", payer: "Trading account" };

    it("lists Fees and bills by the row's own id, after the Owner section, and never by the owner's person id", async () => {
      billsByRow = { [kind.owned.id]: [bill, overdue] };
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      const heading = await within(pane()).findByRole("heading", { name: "Fees and bills" });
      expect(await within(pane()).findByText(/150,000 · due 2026-03-01/)).toBeInTheDocument();
      expect(within(pane()).getByText(/42,000 · due 2026-01-10/)).toBeInTheDocument();
      expect(within(pane()).getByText("Overdue")).toBeInTheDocument();
      const owner = await within(pane()).findByRole("heading", { name: kind.heading });
      expect(owner.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(called).toHaveBeenCalledWith("", "accounting_bill_list", { record_row_id: kind.owned.id });
      expect(called.mock.calls.filter((call) => String(call[1]).startsWith("accounting_") && (call[2] as Record<string, unknown> | undefined)?.actor_id !== undefined)).toHaveLength(0);
    });

    it("lists Payments by the row's own id", async () => {
      paymentsByRow = { [kind.owned.id]: [payment] };
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await within(pane()).findByRole("heading", { name: "Payments" });
      expect(await within(pane()).findByText(/90,000 · paid 2026-02-04/)).toBeInTheDocument();
      expect(called).toHaveBeenCalledWith("", "accounting_payment_list", { record_row_id: kind.owned.id });
    });

    it("shows the bills of the opened row only", async () => {
      billsByRow = { [kind.owned.id]: [bill], [kind.other.id]: [overdue] };
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await within(pane()).findByRole("heading", { name: "Fees and bills" });
      expect(within(pane()).queryByText(/42,000/)).toBeNull();
    });

    const stall = { id: "ten9", place_id: "stall1", holder: "Trading account", kind: "tenant", since: "2025-04-01" };

    it("lists the Holdings of the opened row by its own id, stalls included, after the Payments", async () => {
      holdingsByRow = { [kind.owned.id]: [stall] };
      paymentsByRow = { [kind.owned.id]: [payment] };
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      const heading = await within(pane()).findByRole("heading", { name: "Holdings" });
      expect(await within(pane()).findByText("Stall 4, Market square")).toBeInTheDocument();
      expect(within(pane()).getByText(/tenant · since 2025-04-01/)).toBeInTheDocument();
      const payments = await within(pane()).findByRole("heading", { name: "Payments" });
      expect(payments.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(called).toHaveBeenCalledWith("", "digitaltwin_tenure_list", { holder_record_row_id: kind.owned.id });
      expect(called.mock.calls.filter((call) => call[1] === "digitaltwin_tenure_list" && (call[2] as Record<string, unknown> | undefined)?.holder_actor_id !== undefined)).toHaveLength(0);
    });

    it("shows the holdings of the opened row only", async () => {
      holdingsByRow = { [kind.owned.id]: [stall], [kind.other.id]: [{ ...stall, id: "ten10", place_id: "elsewhere", kind: "owner" }] };
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await within(pane()).findByRole("heading", { name: "Holdings" });
      expect(within(pane()).queryByText(/owner · since/)).toBeNull();
    });

    it.each([
      ["no rows", () => Promise.resolve({ items: [] })],
      ["a refused reply", () => Promise.reject(new mcp.McpError("digitaltwin_tenure_list: the hub refused this"))],
      ["an unserved tool", () => Promise.reject(new Error("digitaltwin_tenure_list: unknown tool"))],
    ])("draws no Holdings heading, no empty card and no error after %s", async (_label, reply) => {
      holdingsReply = reply;
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await vi.waitFor(() => expect(called).toHaveBeenCalledWith("", "digitaltwin_tenure_list", { holder_record_row_id: kind.owned.id }));
      expect(within(pane()).queryByRole("heading", { name: "Holdings" })).toBeNull();
      expect(within(pane()).queryByText(/No .* yet|could not be loaded|refused|unknown tool|not found/i)).toBeNull();
    });

    it.each([
      ["no rows", () => Promise.resolve({ items: [] })],
      ["a refused reply", () => Promise.reject(new mcp.McpError("accounting_bill_list: the hub refused this"))],
      ["an unserved tool", () => Promise.reject(new Error("accounting_bill_list: unknown tool"))],
    ])("draws no Fees and bills or Payments heading, no empty card and no error after %s", async (_label, reply) => {
      billsReply = reply;
      paymentsReply = reply;
      setUp([kind.owned, kind.other]);
      const { pane } = await openRow(kind.owned);

      await vi.waitFor(() => expect(called).toHaveBeenCalledWith("", "accounting_bill_list", { record_row_id: kind.owned.id }));
      expect(within(pane()).queryByRole("heading", { name: "Fees and bills" })).toBeNull();
      expect(within(pane()).queryByRole("heading", { name: "Payments" })).toBeNull();
      expect(within(pane()).queryByText(/No .* yet|could not be loaded|refused|unknown tool|not found/i)).toBeNull();
    });
  });
});

describe("the Licences and permits section of an opened record", () => {
  const rowId = "b1";
  const permit = { id: "s1", form_id: "f1", form_title: "Sample Stall Permit", member_id: ownerId, submitted_at: "2026-11-03T09:30:00Z" };
  let applicationsReply: () => Promise<unknown>;

  const showSection = (owner: string = ownerId, licenceRecord?: string) =>
    render(
      <MemoryRouter>
        <RecordApplications ownerId={owner} rowId={rowId} licenceRecord={licenceRecord} />
      </MemoryRouter>,
    );

  const applicationCalls = () => called.mock.calls.filter((call) => call[1] === "forms_submission_list_of_person");

  beforeEach(() => {
    applicationsReply = async () => ({ items: [permit] });
    called.mockImplementation(async (_agency, name) => (name === "forms_submission_list_of_person" ? applicationsReply() : { items: [] }));
  });

  it("lists the applications of the row under Licences and permits, asked by the owner and the row", async () => {
    showSection();

    expect(await screen.findByRole("heading", { name: "Licences and permits" })).toBeInTheDocument();
    expect(await screen.findByText("Sample Stall Permit", { selector: ".ttl" })).toBeInTheDocument();
    expect(applicationCalls()).toEqual([["", "forms_submission_list_of_person", { member_id: ownerId, record_row_id: rowId }]]);
  });

  it("draws no heading, no empty card and no start act when the row has no applications", async () => {
    applicationsReply = async () => ({ items: [] });
    showSection();

    await vi.waitFor(() => expect(applicationCalls()).toHaveLength(1));
    expect(screen.queryByRole("heading", { name: "Licences and permits" })).toBeNull();
    expect(screen.queryByText(/No .* yet|Start an application/i)).toBeNull();
    expect(document.body.textContent).toBe("");
  });

  it.each([
    ["a refused reply", () => Promise.reject(new mcp.McpError("forms_submission_list_of_person: the hub refused this"))],
    ["an unserved tool", () => Promise.reject(new Error("forms_submission_list_of_person: unknown tool"))],
  ])("draws nothing after %s", async (_label, reply) => {
    applicationsReply = reply;
    showSection();

    await vi.waitFor(() => expect(applicationCalls()).toHaveLength(1));
    expect(screen.queryByRole("heading", { name: "Licences and permits" })).toBeNull();
    expect(document.body.textContent).toBe("");
  });

  describe("with the licence mark of the opened row", () => {
    const serveLicence = (validUntil: string) =>
      called.mockImplementation(async (_agency, name, args) => {
        const given = (args ?? {}) as Record<string, unknown>;
        if (name === "forms_submission_list_of_person") return { items: [permit] };
        if (name === "agency_list_live_record_rows") return { items: given.history ? [] : [{ id: rowId, answers: {} }] };
        if (name === "forms_catalog_entry_list_public") return { items: [{ kind: "licence", form_id: "f1" }] };
        if (name === "forms_submission_list") return { items: [{ id: "s1", form_id: "f1", record_row_id: rowId, decision: "approved" }] };
        if (name === "forms_question_list") return { items: [{ id: "q1", prompt: "Valid until" }] };
        if (name === "forms_answer_list") return { items: [{ send_id: "s1", question_id: "q1", value_date: validUntil }] };
        return { items: [] };
      });

    it("shows Expired beside the heading when the licence ran out before today", async () => {
      serveLicence("2020-01-31");
      showSection(ownerId, "RC-1");

      const mark = await screen.findByText("Expired");
      expect(mark.closest(".heading-row")).toContainElement(screen.getByRole("heading", { name: "Licences and permits" }));
    });

    it("shows Licensed beside the heading when the licence is valid, and no mark without a licence record", async () => {
      serveLicence("2999-12-31");
      showSection(ownerId, "RC-1");

      const mark = await screen.findByText("Licensed");
      expect(mark.closest(".heading-row")).toContainElement(screen.getByRole("heading", { name: "Licences and permits" }));
    });

    it("draws no mark when the record is not a licence record", async () => {
      serveLicence("2020-01-31");
      showSection();

      await screen.findByRole("heading", { name: "Licences and permits" });
      expect(screen.queryByText("Expired")).toBeNull();
      expect(screen.queryByText("Licensed")).toBeNull();
    });
  });

  it("asks for nothing and draws nothing when the row holds no owner", async () => {
    showSection("");

    expect(applicationCalls()).toHaveLength(0);
    expect(document.body.textContent).toBe("");
  });
});
