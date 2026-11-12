import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import * as me from "../wakala/me";
import * as mcp from "../wakala/mcp";
import { donePageSize, mcpDoneClient } from "./done";

type Replies = Record<string, (args: Record<string, unknown>) => unknown>;

const answering = (replies: Replies) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args = {}) => {
    const reply = replies[tool]?.(args);
    if (reply instanceof Error) throw reply;
    return (reply ?? { items: [] }) as any;
  });

const groupOrder = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  poster_id: "p1",
  coordinator: "m9",
  direction: "buy",
  product: "urea",
  state: "closed",
  lines: [],
  created_at: "2026-10-01T09:00:00Z",
  ...over,
});

const single = (over: Record<string, unknown> = {}) => ({ id: "o1", product: "maize seed", state: "cancelled", ...over });

const sentStep = (over: Record<string, unknown> = {}) => ({
  step_id: "s1",
  title: "Group fertilizer order",
  form_name: "Fertilizer",
  workflow_name: "Fertilizer for the group",
  row_id: "r1",
  order_id: "",
  sent_at: "2026-10-21T10:00:00Z",
  answers: {},
  ...over,
});

const byState = (rows: Record<string, unknown[]>): Replies["market_list_group_orders"] => (args) => ({
  items: rows[String(args.state)] ?? [],
});

beforeEach(() => {
  vi.spyOn(me, "loadSubject").mockResolvedValue("m1");
  openAgency("farmers");
});

afterEach(() => {
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("nothing finished", () => {
  it("lists nothing and has no next page when every source is empty", async () => {
    answering({});
    expect(await mcpDoneClient.read(null)).toEqual({ items: [], failed: [], next: null });
  });
});

describe("the group orders she finished", () => {
  it("asks for only her own closed and called-off ones, one page each", async () => {
    const spy = answering({});
    await mcpDoneClient.read(null);
    const asked = spy.mock.calls.filter(([, tool]) => tool === "market_list_group_orders").map(([, , args]) => args);
    expect(asked).toEqual(
      expect.arrayContaining([
        { mine: true, state: "closed", limit: donePageSize },
        { mine: true, state: "cancelled", limit: donePageSize },
      ]),
    );
  });

  it("shows a closed one as Closed on the day it closed, with her page for it", async () => {
    answering({ market_list_group_orders: byState({ closed: [groupOrder({ closed_at: "2026-11-03T12:00:00Z" })] }) });
    const { items } = await mcpDoneClient.read(null);
    expect(items).toEqual([
      { id: "order-g1", workflow: "Group order", title: "urea", state: "Closed", endedAt: "2026-11-03T12:00:00Z", path: "/my-orders/group/g1" },
    ]);
  });

  it("shows a called-off one as Called off on the day it was called off", async () => {
    answering({ market_list_group_orders: byState({ cancelled: [groupOrder({ id: "g2", state: "cancelled", cancelled_at: "2026-10-28T12:00:00Z" })] }) });
    const [row] = (await mcpDoneClient.read(null)).items;
    expect([row.state, row.endedAt]).toEqual(["Called off", "2026-10-28T12:00:00Z"]);
  });

  it("opens the coordinator's page for an order she started and names it Create group order", async () => {
    answering({ market_list_group_orders: byState({ closed: [groupOrder({ coordinator: "m1", closed_at: "2026-11-03T12:00:00Z" })] }) });
    const [row] = (await mcpDoneClient.read(null)).items;
    expect([row.workflow, row.path]).toEqual(["Create group order", "/coordinator/orders/g1"]);
  });

  it("names the product by the shop's words", async () => {
    answering({
      market_list_group_orders: byState({ closed: [groupOrder({ closed_at: "2026-11-03T12:00:00Z" })] }),
      market_list_offers: () => ({ items: [{ id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: "3800" }] }),
    });
    expect((await mcpDoneClient.read(null)).items[0].title).toBe("Urea 50kg");
  });

  it("leaves out a group order that is a sale", async () => {
    answering({ market_list_group_orders: byState({ closed: [groupOrder({ direction: "sell", closed_at: "2026-11-03T12:00:00Z" })] }) });
    expect((await mcpDoneClient.read(null)).items).toEqual([]);
  });
});

describe("the single orders she finished", () => {
  it("asks for the delivered and the cancelled ones, one page each", async () => {
    const spy = answering({});
    await mcpDoneClient.read(null);
    const asked = spy.mock.calls.filter(([, tool]) => tool === "market_list_orders").map(([, , args]) => args);
    expect(asked).toEqual(expect.arrayContaining([{ state: "delivered", limit: donePageSize }, { state: "cancelled", limit: donePageSize }]));
  });

  it("shows a delivered one on its delivery day and a cancelled one as Called off", async () => {
    answering({
      market_list_orders: (args) => ({
        items:
          args.state === "delivered"
            ? [single({ id: "o1", state: "delivered", delivered_at: "2026-11-05T12:00:00Z" })]
            : [single({ id: "o2", cancelled_at: "2026-11-01T12:00:00Z" })],
      }),
    });
    expect((await mcpDoneClient.read(null)).items).toEqual([
      { id: "single-o1", workflow: "Order", title: "maize seed", state: "Delivered", endedAt: "2026-11-05T12:00:00Z", path: "/my-orders/o1" },
      { id: "single-o2", workflow: "Order", title: "maize seed", state: "Called off", endedAt: "2026-11-01T12:00:00Z", path: "/my-orders/o2" },
    ]);
  });
});

describe("the forms she sent", () => {
  it("shows one as a Form that was Sent, titled by the step, with no page to open", async () => {
    answering({ agency_list_my_sent_steps: () => ({ items: [sentStep()] }) });
    expect((await mcpDoneClient.read(null)).items).toEqual([
      { id: "form-r1", workflow: "Form", title: "Group fertilizer order", state: "Sent", endedAt: "2026-10-21T10:00:00Z", path: "" },
    ]);
  });

  it("asks for one page of her sent steps", async () => {
    const spy = answering({});
    await mcpDoneClient.read(null);
    expect(spy.mock.calls.find(([, tool]) => tool === "agency_list_my_sent_steps")?.[2]).toEqual({ limit: donePageSize });
  });
});

describe("paging", () => {
  const full = (make: (n: number) => unknown) => Array.from({ length: donePageSize }, (_, n) => make(n));

  it("has a next page when a source filled its page, and reads on after the last id it showed", async () => {
    const spy = answering({
      agency_list_my_sent_steps: (args) =>
        args.after ? { items: [sentStep({ row_id: "rLast", sent_at: "2026-01-01T10:00:00Z" })] } : { items: full((n) => sentStep({ row_id: `r${n}`, sent_at: `2026-10-${10 + (n % 10)}T10:00:00Z` })) },
    });
    const first = await mcpDoneClient.read(null);
    expect(first.items).toHaveLength(donePageSize);
    expect(first.next).not.toBeNull();
    const second = await mcpDoneClient.read(first.next);
    expect(second.items.map((item) => item.id)).toEqual(["form-rLast"]);
    expect(second.next).toBeNull();
    const lastCall = spy.mock.calls.filter(([, tool]) => tool === "agency_list_my_sent_steps").at(-1);
    expect(lastCall?.[2]).toEqual({ limit: donePageSize, after: `r${donePageSize - 1}` });
  });

  it("does not ask a source again once it has run out", async () => {
    const spy = answering({ agency_list_my_sent_steps: () => ({ items: full((n) => sentStep({ row_id: `r${n}` })) }) });
    const first = await mcpDoneClient.read(null);
    await mcpDoneClient.read(first.next);
    expect(spy.mock.calls.filter(([, tool]) => tool === "market_list_orders")).toHaveLength(2);
    expect(spy.mock.calls.filter(([, tool]) => tool === "market_list_group_orders")).toHaveLength(2);
  });
});

describe("a source that fails", () => {
  it("still lists the others and names the failed one, which stays to be read again", async () => {
    answering({
      agency_list_my_sent_steps: () => new Error("down"),
      market_list_group_orders: byState({ closed: [groupOrder({ closed_at: "2026-11-03T12:00:00Z" })] }),
    });
    const page = await mcpDoneClient.read(null);
    expect(page.items.map((item) => item.id)).toEqual(["order-g1"]);
    expect(page.failed).toEqual(["sentSteps"]);
    expect(page.next).not.toBeNull();
  });

  it("fails as a whole when every source fails", async () => {
    answering({
      agency_list_my_sent_steps: () => new Error("down"),
      market_list_group_orders: () => new Error("down"),
      market_list_orders: () => new Error("down"),
    });
    await expect(mcpDoneClient.read(null)).rejects.toThrow("down");
  });

  it("treats a market the agency does not run as empty and not as a failure", async () => {
    answering({
      market_list_group_orders: () => new Error("instance not found"),
      market_list_orders: () => new Error("instance not found"),
    });
    expect(await mcpDoneClient.read(null)).toEqual({ items: [], failed: [], next: null });
  });
});
