import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

type Args = Record<string, unknown>;

const entries = [
  { id: "e1", slug: "market-stall-permit", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1" },
  { id: "e4", slug: "hall-hire-fee", name: "Hall Hire Fee", summary: "Hire the town hall", kind: "fee", form_id: "f4" },
];

const catalogue = [{ id: "c1", slug: "bulk-waste", name: "Bulk Waste Collection", summary: "Book a collection for large items" }];

const sentOn: Record<string, unknown[]> = {
  "market-stall-permit": [{ id: "s1", form_id: "f1", member_id: "m1", submitted_at: "2026-03-04T12:00:00Z", paid: false }],
  "hall-hire-fee": [{ id: "s4", form_id: "f4", member_id: "m1", submitted_at: "2026-03-12T12:00:00Z", paid: false }],
};

const answeredForms = [{ send_id: "n1", form_id: "f1", title: "Market stall application", answered_at: "2026-03-04T12:00:00Z", open: true }];

let called: MockInstance<typeof mcp.callTool>;
let tools: Record<string, (args: Args) => unknown>;

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  setWide(true);
  tools = {
    agency_list_mounts: () => ({ modules: [{ module: "forms" }] }),
    agency_get_my_roles: () => ({ permissions: ["form.results", "service.edit", "application.correct"] }),
    forms_catalog_entry_list_public: (args) => ({ items: args.kind ? entries.filter((entry) => entry.kind === args.kind) : catalogue }),
    forms_catalog_entry_submissions_mine: (args) => sentOn[String(args.slug)] ?? [],
    forms_catalog_entry_read: () => ({ item: catalogue[0] }),
    forms_submission_read_mine: () => ({ id: "s1", form_id: "f1", sent_at: "2026-03-04T12:00:00Z" }),
    forms_question_list: () => ({ items: [{ id: "q1", prompt: "Stall location" }] }),
    forms_answer_list: () => ({ items: [{ id: "a1", question_id: "q1", value_text: "Riverside Square", member_id: "m1" }] }),
    forms_form_read: () => ({ id: "f4", amount: 4500 }),
    actor_get_actor: () => ({ id: "m1", display_name: "Kovács Márta" }),
    forms_form_list_answered: () => ({ items: answeredForms }),
    forms_form_list: () => ({ rows: [] }),
  };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = tools[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const openRow = async (title: string, row: RegExp) => {
  const path = items.find((item) => item.title === title)?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: row }));
  return within(document.querySelector(".wf-main") as HTMLElement);
};

describe("a Services & Permits page is built like a resident page", () => {
  it("titles a permit with its name, draws no band and the bottom bar", async () => {
    const pane = await openRow("Permits", /Market Stall Permit/);
    expect(await pane.findByRole("heading", { level: 1, name: "Market Stall Permit" })).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(document.querySelector(".wf-status")).toBeNull();
  });

  it("holds a permit's sent days in a Details card", async () => {
    const pane = await openRow("Permits", /Market Stall Permit/);
    const card = within(await pane.findByRole("region", { name: "Details" }));
    expect(card.getByText("Sent on")).toBeInTheDocument();
  });

  it("titles a fee with its name and holds Amount and Payer in a Details card with Mark paid in the footer", async () => {
    const pane = await openRow("Fees & Payments", /Hall Hire Fee/);
    expect(await pane.findByRole("heading", { level: 1, name: "Hall Hire Fee" })).toBeInTheDocument();
    const card = within(await pane.findByRole("region", { name: "Details" }));
    expect(card.getByText("Amount")).toBeInTheDocument();
    expect(card.getByText("Kovács Márta")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Mark paid" }).closest("footer")).not.toBeNull();
    await userEvent.click(card.getByRole("button", { name: "Mark paid" }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_mark_paid", { form_id: "f4", member_id: "m1", paid: true }));
  });

  it("titles an application with its form's name and holds the answers in an Application card with Withdraw in the footer", async () => {
    tools.forms_form_withdraw = () => ({});
    const pane = await openRow("Applications", /Market stall application/);
    expect(await pane.findByRole("heading", { level: 1, name: "Market stall application" })).toBeInTheDocument();
    const card = within(await pane.findByRole("region", { name: "Application" }));
    expect(card.getByText("Riverside Square")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Withdraw" }).closest("footer")).not.toBeNull();
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("titles a catalogue entry with its name and draws no band", async () => {
    const pane = await openRow("Service Catalogue", /Bulk Waste Collection/);
    expect(await pane.findByRole("heading", { level: 1, name: "Bulk Waste Collection" })).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
  });
});
