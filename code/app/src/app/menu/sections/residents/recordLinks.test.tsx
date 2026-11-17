import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
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
  "accounting_bill_list",
  "accounting_payment_list",
  "digitaltwin_tenure_list",
  "forms_submission_list",
  "forms_submission_list_of_person",
  "audit_list_entries",
  "forms_catalog_booking_list_of_person",
];

let called: MockInstance<typeof mcp.callTool>;
let rowsByCode: Record<string, Row[]>;
let actorReply: () => Promise<unknown>;

const actorCalls = () => called.mock.calls.filter((call) => call[1] === "actor_get_actor");

const withoutOwnerPrompt = (row: Row, prompt: string): Row => ({ id: row.id, answers: Object.fromEntries(Object.entries(row.answers).filter(([key]) => key !== prompt)) });

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_live_record_rows") return { items: rowsByCode[String(given.record_code)] ?? [] };
  if (name === "actor_get_actor") return actorReply();
  if (name === "actor_list_actors") return { items: [{ id: ownerId, display_name: personName, status: "active" }] };
  if (name === "accounting_bill_list") return { items: [{ id: "bill1", payer: personName }] };
  if (name === "accounting_payment_list") return { items: [{ id: "pay1", payer: personName }] };
  if (name === "digitaltwin_tenure_list") return { items: [{ id: "ten1", holder: personName }] };
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

    it("lists no bills, payments, holdings, applications, audit entries or bookings for the record", async () => {
      setUp([kind.owned, kind.unowned]);
      const { pane } = await openRow(kind.owned);

      await within(pane()).findByRole("heading", { name: kind.heading });
      const names = called.mock.calls.map((call) => call[1]);
      unlinkedTools.forEach((tool) => expect(names).not.toContain(tool));
      expect(within(pane()).queryByText(/bill|payment|permit|inspection|booking|holding/i)).toBeNull();
    });
  });
});
