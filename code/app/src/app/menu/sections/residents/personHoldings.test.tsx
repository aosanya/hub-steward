import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { businessesRecordCode } from "./BusinessesScreen";
import { informalTradersRecordCode } from "./InformalTradersScreen";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = { id: string; holder: string; answers: Record<string, string> };
type Reply = "rows" | "refused" | "record not found" | "instance not found";

const personName = "Sample Resident A";
const personId = "p1";
const otherId = "p2";

let called: MockInstance<typeof mcp.callTool>;
let rowsByRecord: Record<string, Row[]>;
let replyByRecord: Record<string, Reply>;

const bakery: Row = {
  id: "b1",
  holder: personId,
  answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", Neighbourhood: "Malomsor" },
};

const sameNameBusiness: Row = {
  id: "b2",
  holder: otherId,
  answers: { "Trading name": personName, "Kind of business": "Florist", Neighbourhood: "Óváros" },
};

const flowerSeller: Row = {
  id: "t1",
  holder: personId,
  answers: { "Name or alias": "Flower Corner", "What is sold": "Flowers", Neighbourhood: "Kertváros" },
};

const sameNameTrader: Row = {
  id: "t2",
  holder: otherId,
  answers: { "Name or alias": personName, "What is sold": "Honey", Neighbourhood: "Határrét" },
};

const stripHolder = ({ id, answers }: Row) => ({ id, answers });

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view"] };
  if (name === "actor_list_actors") return { items: [{ id: personId, display_name: personName, status: "active" }] };
  if (name === "actor_get_actor") return { id: personId, display_name: personName, status: "active" };
  if (name === "actor_list_groups_for_actor") return { items: [{ group_id: "g1" }] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: "Sample Street Group" }] };
  if (name === "actor_list_attribute_properties") return { items: [] };
  if (name === "forms_submission_list_of_person") return { items: [{ id: "s1", form_id: "f1", form_title: "Sample Stall Permit", member_id: personId, submitted_at: "2026-11-03T09:30:00Z" }] };
  if (name === "agency_list_live_record_rows") {
    const code = String(given.record_code);
    const reply = replyByRecord[code] ?? "rows";
    if (reply === "refused") throw new mcp.McpError("agency_list_live_record_rows: the hub refused this");
    if (reply === "record not found") throw new Error("agency_list_live_record_rows: record not found");
    if (reply === "instance not found") throw new Error("agency_list_live_record_rows: instance not found");
    const rows = rowsByRecord[code] ?? [];
    const chosen = given.answer_actor_id === undefined ? rows : rows.filter((row) => row.holder === given.answer_actor_id);
    return { items: chosen.map(stripHolder) };
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  rowsByRecord = {
    [businessesRecordCode]: [bakery, sameNameBusiness],
    [informalTradersRecordCode]: [flowerSeller, sameNameTrader],
  };
  replyByRecord = {};
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
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByText("Sample Street Group");
};

const rowCalls = () => called.mock.calls.filter((call) => call[1] === "agency_list_live_record_rows");

describe("businesses and informal traders on a person's panel", () => {
  it("asks for the Businesses rows and the Informal traders rows held by the person, by record code and actor id", async () => {
    await openPerson();

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_list_live_record_rows", { record_code: businessesRecordCode, answer_actor_id: personId }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_list_live_record_rows", { record_code: informalTradersRecordCode, answer_actor_id: personId }));
  });

  it("never asks for the rows of a record without the person's actor id", async () => {
    await openPerson();

    await screen.findByRole("heading", { name: /^Businesses/ });
    await screen.findByRole("heading", { name: /^Informal traders/ });
    expect(rowCalls().length).toBeGreaterThan(0);
    for (const call of rowCalls()) {
      expect((call[2] as Record<string, unknown>).answer_actor_id).toBe(personId);
    }
  });

  it("shows a Businesses section with the trading name, kind of business and neighbourhood of each row held", async () => {
    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Businesses/ })).toBeTruthy();
    expect(await screen.findByText("Malomsor Bakery")).toBeTruthy();
    expect(screen.getByText("Bakery · Malomsor")).toBeTruthy();
  });

  it("shows an Informal traders section with the name, what is sold and neighbourhood of each row held", async () => {
    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Informal traders/ })).toBeTruthy();
    expect(await screen.findByText("Flower Corner")).toBeTruthy();
    expect(screen.getByText("Flowers · Kertváros")).toBeTruthy();
  });

  it("shows no heading and no empty card for a record the person holds nothing in, and the other record still shows", async () => {
    rowsByRecord = { [businessesRecordCode]: [sameNameBusiness], [informalTradersRecordCode]: [flowerSeller] };

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Informal traders/ })).toBeTruthy();
    expect(screen.getByText("Flower Corner")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Businesses/ })).toBeNull();
    expect(screen.queryByText(/No businesses/i)).toBeNull();
  });

  it("leaves the panel as it was for a person who holds nothing", async () => {
    rowsByRecord = { [businessesRecordCode]: [sameNameBusiness], [informalTradersRecordCode]: [sameNameTrader] };

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Applications/ })).toBeTruthy();
    await waitFor(() => expect(rowCalls()).toHaveLength(2));
    expect(screen.getByRole("heading", { name: /^Groups/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Businesses/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Informal traders/ })).toBeNull();
    expect(screen.queryByText(/No businesses|No informal traders/i)).toBeNull();
  });

  it.each<[string, Reply]>([
    ["refused", "refused"],
    ["record not found", "record not found"],
    ["instance not found", "instance not found"],
  ])("shows nothing for a record whose reply is '%s', keeps the other record, Groups and Applications, and shows no error", async (_label, reply) => {
    replyByRecord = { [businessesRecordCode]: reply };

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Informal traders/ })).toBeTruthy();
    expect(screen.getByText("Flower Corner")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Groups/ })).toBeTruthy();
    expect(screen.getByText("Sample Street Group")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: /^Applications/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Businesses/ })).toBeNull();
    expect(screen.queryByText("Malomsor Bakery")).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
    expect(screen.queryByText(/the hub refused this/)).toBeNull();
    expect(screen.queryByText(/not found/)).toBeNull();
  });

  it("shows no holdings and keeps Groups and Applications when both records are refused", async () => {
    replyByRecord = { [businessesRecordCode]: "refused", [informalTradersRecordCode]: "record not found" };

    await openPerson();

    expect(await screen.findByRole("heading", { name: /^Applications/ })).toBeTruthy();
    await waitFor(() => expect(rowCalls()).toHaveLength(2));
    expect(screen.getByRole("heading", { name: /^Groups/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Businesses/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Informal traders/ })).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  it("shows the rows as plain rows, not links or buttons", async () => {
    await openPerson();

    await screen.findByText("Malomsor Bakery");
    await screen.findByText("Flower Corner");
    expect(screen.queryByRole("link", { name: /Malomsor Bakery|Flower Corner/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Malomsor Bakery|Flower Corner/ })).toBeNull();
  });

  it("derives nothing from a name match: a row titled with the person's name that another actor holds is not shown", async () => {
    await openPerson();

    await screen.findByText("Malomsor Bakery");
    await screen.findByText("Flower Corner");
    expect(screen.queryByText("Florist · Óváros")).toBeNull();
    expect(screen.queryByText("Honey · Határrét")).toBeNull();
    expect(screen.getAllByText(personName)).toHaveLength(2);
  });
});
