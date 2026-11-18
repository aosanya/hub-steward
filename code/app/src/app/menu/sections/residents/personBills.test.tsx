import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Failure = "none" | "refused" | "unknown";

type Bill = Record<string, unknown>;

let called: MockInstance<typeof mcp.callTool>;
let held: Bill[];
let billListFailure: Failure;

const refusalWords = "accounting_bill_list: the hub refused this";

const bill = (id: string, payerActorId: string, amount: number, dueAt: string, status: string, daysOverdue = 0): Bill => ({
  id,
  payer: "Sample Resident A",
  payer_actor_id: payerActorId,
  amount,
  due_at: dueAt,
  status,
  days_overdue: daysOverdue,
  narration: "",
});

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "accounting" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view"] };
  if (name === "actor_list_actors") return { items: [{ id: "p1", display_name: "Sample Resident A", status: "active" }] };
  if (name === "actor_get_actor") return { id: "p1", display_name: "Sample Resident A", status: "active" };
  if (name === "actor_list_groups_for_actor") return { items: [{ group_id: "g1" }] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: "Sample Street Group" }] };
  if (name === "actor_list_attribute_properties") return { items: [] };
  if (name === "accounting_bill_list") {
    if (billListFailure === "refused") throw new mcp.McpError(refusalWords);
    if (billListFailure === "unknown") throw new Error("accounting_bill_list: unknown tool");
    return {
      items: held
        .filter((row) => given.actor_id === undefined || row.payer_actor_id === given.actor_id)
        .filter((row) => given.payer === undefined || row.payer === given.payer),
    };
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  billListFailure = "none";
  held = [];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const BillPage = () => {
  const here = useLocation();
  const from = (here.state as { from?: { path?: string; title?: string } } | null)?.from;
  return (
    <p data-testid="bill-page">
      {here.pathname}{here.search} from {from?.path} titled {from?.title}
    </p>
  );
};

const peoplePath = () => items.find((item) => item.title === "All People")?.path?.() ?? "";

const renderPeople = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routes()}
        <Route path="/a/:agencyId/menu/finance/revenue-and-billing" element={<BillPage />} />
      </Routes>
    </MemoryRouter>,
  );

const openPerson = async () => {
  renderPeople(peoplePath());
  await userEvent.click(await screen.findByRole("button", { name: /Sample Resident A/ }));
  await screen.findByText("Sample Street Group");
};

const billCalls = () => called.mock.calls.filter((call) => call[1] === "accounting_bill_list");

const rowOf = (meta: string) => screen.getByText(meta).closest(".row") as HTMLElement;

describe("bills on a person's detail", () => {
  it("shows the Bills heading and a row for each bill of the person, asked for by the person's id, newest due first", async () => {
    held = [bill("b1", "p1", 1500, "2026-01-15T00:00:00Z", "overdue", 40), bill("b2", "p1", 900, "2026-03-01T00:00:00Z", "settled")];

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Bills/ })).toBeTruthy();
    expect(await screen.findByText("900 · due 2026-03-01")).toBeTruthy();
    expect(screen.getByText("1,500 · due 2026-01-15 · 40 days late")).toBeTruthy();
    expect(screen.getByText("Settled")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    const order = screen.getAllByText(/ · due /).map((line) => line.textContent);
    expect(order).toEqual(["900 · due 2026-03-01", "1,500 · due 2026-01-15 · 40 days late"]);
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "accounting_bill_list", { actor_id: "p1" }));
  });

  it("opens the bill when its row is pressed: Revenue & Billing with the bill id, and a way back to this resident", async () => {
    held = [bill("b1", "p1", 900, "2026-03-01T00:00:00Z", "open"), bill("b2", "p1", 1500, "2026-01-15T00:00:00Z", "overdue", 40)];

    await openPerson();

    await userEvent.click(await screen.findByRole("button", { name: /1,500 · due 2026-01-15/ }));

    const landed = (await screen.findByTestId("bill-page")).textContent ?? "";
    expect(landed).toContain("/menu/finance/revenue-and-billing?bill=b2");
    expect(landed).toContain("person=p1");
    expect(landed).toContain("titled Residents");
  });

  it("gives every bill row a button of its own, with its status shown beside it", async () => {
    held = [bill("b1", "p1", 900, "2026-03-01T00:00:00Z", "open"), bill("b2", "p1", 1500, "2026-01-15T00:00:00Z", "overdue", 40)];

    await openPerson();

    await screen.findByText("900 · due 2026-03-01");
    expect(rowOf("900 · due 2026-03-01").tagName).toBe("BUTTON");
    expect(rowOf("1,500 · due 2026-01-15 · 40 days late").tagName).toBe("BUTTON");
    expect(within(rowOf("900 · due 2026-03-01")).getByText("Open")).toBeTruthy();
  });

  it("opens the resident named in the address by itself, so a way back from a bill lands on the same person", async () => {
    renderPeople(`${peoplePath()}?person=p1`);

    expect(await screen.findByText("Sample Street Group")).toBeTruthy();
    expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p1" });
  });

  it("shows an empty card when the person has no bill", async () => {
    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Bills/ })).toBeTruthy();
    expect(await screen.findByText("No bills yet.")).toBeTruthy();
    expect(screen.queryByText(/ · due /)).toBeNull();
  });

  it.each<[string, Failure]>([
    ["refused", "refused"],
    ["not served", "unknown"],
  ])("shows no Bills and no error when the bill list is %s, and the Groups still show", async (_label, failure) => {
    billListFailure = failure;

    await openPerson();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "accounting_bill_list", { actor_id: "p1" }));
    expect(screen.getByRole("heading", { name: /^Groups/ })).toBeTruthy();
    expect(screen.getByText("Sample Street Group")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Bills/ })).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
    expect(screen.queryByText(/the hub refused this/)).toBeNull();
    expect(screen.queryByText(/unknown tool/)).toBeNull();
  });

  it("finds bills by the person's id only: never by name, and never shows a bill held under another id with the same payer text", async () => {
    held = [bill("b1", "p1", 900, "2026-03-01T00:00:00Z", "open"), bill("b2", "p2", 777, "2026-05-05T00:00:00Z", "open")];

    await openPerson();

    expect(await screen.findByText("900 · due 2026-03-01")).toBeTruthy();
    expect(screen.queryByText("777 · due 2026-05-05")).toBeNull();
    expect(billCalls().length).toBeGreaterThan(0);
    for (const call of billCalls()) {
      expect(call[2]).toEqual({ actor_id: "p1" });
      expect(Object.keys((call[2] ?? {}) as Record<string, unknown>)).not.toContain("payer");
    }
  });

  it("shows the empty card, not a namesake's bill, when only another actor's bill carries the person's name", async () => {
    held = [bill("b2", "p2", 777, "2026-05-05T00:00:00Z", "open")];

    await openPerson();

    expect(await screen.findByText("No bills yet.")).toBeTruthy();
    expect(screen.queryByText("777 · due 2026-05-05")).toBeNull();
  });
});
