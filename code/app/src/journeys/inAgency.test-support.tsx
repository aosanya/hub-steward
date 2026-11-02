import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, vi } from "vitest";
import { App } from "../App";
import { forgetOpenAgency } from "../agency/open";
import { provideEntryClient, type Agency, type EntryClient } from "../entry/api";
import { provideWaitingCount, restoreWaitingCount } from "../entry/waiting";
import { forgetRuntimeConfig, setRuntimeConfig } from "../wakala/config";
import { resetMcp } from "../wakala/mcp";

export const farmers: Agency = { id: "270e07b7-6b69-55ca-aa30-9441ce138541", name: "Siaya Farmers' Group" };
export const riders: Agency = { id: "c61e4358-10fd-539b-89f5-a7ccf4e94479", name: "Siaya Boda Boda Riders" };

type Reply = (args: Record<string, unknown>) => unknown;

export type SentCall = { tool: string; args: Record<string, unknown>; instance: unknown };

const entryClientOf = (agencies: Agency[]): EntryClient => ({
  sendSignInLink: async () => "sent",
  listAgencies: async () => agencies,
  searchDirectory: async () => [],
  join: async () => "joined",
});

export const stubWakala = (replies: Record<string, Reply> = {}) => {
  const sent: SentCall[] = [];
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}"));
    let result: unknown = {};
    if (body.method === "tools/call") {
      const args = body.params.arguments ?? {};
      sent.push({ tool: String(body.params.name), args, instance: args.instance_id });
      result = { structuredContent: replies[body.params.name]?.(args) ?? { items: [] } };
    }
    const text = JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result });
    return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
  });
  vi.stubGlobal("fetch", fetcher);
  return { sent, fetcher, named: (tool: string) => sent.filter((call) => call.tool === tool) };
};

export const everyCallNames = (sent: SentCall[], agency: Agency) => {
  expect(sent.length).toBeGreaterThan(0);
  sent.forEach((call) => expect(call.instance, call.tool).toBe(agency.id));
};

export const startInAgencies = () => {
  setRuntimeConfig({ mcp: "https://api.example/mcp" });
  resetMcp();
  forgetOpenAgency();
  provideWaitingCount(async () => 0);
};

export const endInAgencies = () => {
  restoreWaitingCount();
  vi.unstubAllGlobals();
  forgetRuntimeConfig();
  resetMcp();
  forgetOpenAgency();
};

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

export const where = () => screen.getByTestId("where").textContent ?? "";

export const openApp = (path: string, agencies: Agency[] = [farmers, riders]) => {
  provideEntryClient(entryClientOf(agencies));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );
};

export const groupOrderStep = {
  id: "s1",
  title: "Start the urea group order",
  kind: "fill_form",
  role_name: "Group coordinator",
  form_name: "Urea group order",
  questions: [
    { prompt: "Product", answer_type: "free_text" },
    { prompt: "Price a bag", answer_type: "currency" },
    { prompt: "Minimum bags", answer_type: "number" },
  ],
};

export const startingAnOrder: Record<string, Reply> = {
  agency_list_my_open_steps: () => ({ items: [groupOrderStep] }),
  market_get_group_order_poster: () => ({ poster_id: "p1", poster_name: "Kisumu Agro Supplies" }),
  market_start_group_order: () => ({ id: "g1" }),
};

const kisumuShop = { id: "p-kisumu", name: "Kisumu Agro Supplies", status: "approved", availability: "open" };

const ureaOffer = { id: "o1", poster_id: kisumuShop.id, product: "urea", product_words: "Urea 50kg", unit_words: "bag", price: 3800 };

const waitingOrder = { id: "or1", poster_id: kisumuShop.id, offer_id: ureaOffer.id, quantity: 2, unit_price: 3800, state: "waiting", paid: false };

export const shoppingForUrea: Record<string, Reply> = {
  market_list_posters: () => ({ items: [kisumuShop] }),
  market_list_offers: () => ({ items: [ureaOffer] }),
  market_buy_now: () => waitingOrder,
  market_get_order: () => waitingOrder,
};

export const answeringAForm: Record<string, Reply> = {
  forms_form_list_waiting: () => ({
    items: [{ form_id: "f1", title: "Water levy", closes_at: "2026-11-30T00:00:00Z", questions: 1, answered: false, unanswered_as: [] }],
  }),
  forms_question_list: () => ({ items: [{ id: "q1", prompt: "What do you need", answer_type: "free_text", required: true, options: [] }] }),
  forms_answer_submit: () => ({}),
};

const farmersRoom = { id: "r1", name: "Siaya farmers" };

const roomThreads = [
  { id: "t1", label: "General", audience: "group", requested_by: "", unread: 0, last_message_at: "" },
  { id: "t2", label: "Water levy", audience: "group", requested_by: "", unread: 0, last_message_at: "" },
];

export const chattingInARoom: Record<string, Reply> = {
  actor_list_my_groups: () => ({ items: [farmersRoom] }),
  comm_chat_thread_list: () => ({ items: roomThreads }),
  comm_chat_message_list: () => ({ items: [] }),
  comm_chat_message_post: () => ({}),
  market_list_asks: () => ({ items: [{ id: "a1", asker: "Asha Otieno", question: "2 bags of urea by Friday", state: "waiting" }] }),
};
