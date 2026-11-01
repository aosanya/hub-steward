import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import * as me from "../wakala/me";
import * as mcp from "../wakala/mcp";
import { mcpStartedClient, startedAnswerOf, type StartedClient } from "./api";

type Replies = Record<string, unknown>;

const answering = (replies: Replies) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return (reply ?? { items: [] }) as any;
  });

const groupOrder = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  poster_id: "p1",
  coordinator: "m9",
  direction: "buy",
  product: "urea",
  state: "open",
  lines: [],
  ...over,
});

const offer = { id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: "3800" };

const shop = (over: Record<string, unknown> = {}) => ({ id: "s1", name: "Asha Agrovet", owner: "m1", status: "pending", ...over });

beforeEach(() => {
  vi.spyOn(me, "loadSubject").mockResolvedValue("m1");
  openAgency("farmers");
});

afterEach(() => {
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("nothing started", () => {
  it("lists nothing when every source is empty", async () => {
    answering({});
    expect(await mcpStartedClient.list()).toEqual([]);
  });
});

describe("the group order she started as coordinator", () => {
  it("shows an open one with its product, state and her order page", async () => {
    answering({ market_list_group_orders: { items: [groupOrder({ id: "g1", coordinator: "m1" })] } });
    expect(await mcpStartedClient.list()).toEqual([
      { id: "order-g1", workflow: "Create group order", title: "urea", state: "Open", path: "/coordinator/orders/g1" },
    ]);
  });

  it("shows the product by the shop's words when the offers name it", async () => {
    answering({
      market_list_group_orders: { items: [groupOrder({ id: "g1", coordinator: "m1" })] },
      market_list_offers: { items: [offer] },
    });
    expect((await mcpStartedClient.list())[0].title).toBe("Urea 50kg");
  });

  it("takes the words only from the offers of the order's own shop", async () => {
    answering({
      market_list_group_orders: { items: [groupOrder({ coordinator: "m1" })] },
      market_list_offers: { items: [{ ...offer, poster_id: "p2", product_words: "Other shop urea" }] },
    });
    expect((await mcpStartedClient.list())[0].title).toBe("urea");
  });

  it("falls back to the product the result names when offers cannot be read", async () => {
    answering({
      market_list_group_orders: { items: [groupOrder({ coordinator: "m1" })] },
      market_list_offers: new Error("offers down"),
    });
    expect((await mcpStartedClient.list())[0].title).toBe("urea");
  });

  it("says Revising while new terms are out", async () => {
    answering({ market_list_group_orders: { items: [groupOrder({ coordinator: "m1", state: "revising" })] } });
    expect((await mcpStartedClient.list())[0].state).toBe("Revising");
  });

  it("leaves out an order that was sent, closed or cancelled", async () => {
    answering({
      market_list_group_orders: {
        items: ["sent", "closed", "cancelled", "done"].map((state, n) => groupOrder({ id: `g${n}`, coordinator: "m1", state })),
      },
    });
    expect(await mcpStartedClient.list()).toEqual([]);
  });

  it("leaves out a sell group order", async () => {
    answering({ market_list_group_orders: { items: [groupOrder({ coordinator: "m1", direction: "sell" })] } });
    expect(await mcpStartedClient.list()).toEqual([]);
  });

  it("leaves out a live order another coordinator started", async () => {
    answering({ market_list_group_orders: { items: [groupOrder({ coordinator: "m9" })] } });
    expect(await mcpStartedClient.list()).toEqual([]);
  });

  it("gives one row when she also joined her own order", async () => {
    answering({
      market_list_group_orders: { items: [groupOrder({ coordinator: "m1", lines: [{ picker: "m1", quantity: 2 }] })] },
      market_list_offers: { items: [offer] },
    });
    const rows = await mcpStartedClient.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe("/coordinator/orders/g1");
  });
});

describe("group orders beyond the first page", () => {
  const strangersOrders = Array.from({ length: 200 }, (_, n) => groupOrder({ id: `g${String(n).padStart(4, "0")}`, coordinator: "m9" }));

  const pagedOrders = (pages: Record<string, unknown[]>) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
      if (tool !== "market_list_group_orders") return { items: [] } as any;
      return { items: pages[String((args as any)?.after ?? "")] ?? [] } as any;
    });

  it("shows an order she started that is on the second page", async () => {
    pagedOrders({ "": strangersOrders, g0199: [groupOrder({ id: "g0200", coordinator: "m1" })] });
    expect((await mcpStartedClient.list()).map((row) => row.id)).toEqual(["order-g0200"]);
  });

  it("shows an order she joined that is on the second page", async () => {
    pagedOrders({ "": strangersOrders, g0199: [groupOrder({ id: "g0200", lines: [{ picker: "m1", quantity: 2 }] })] });
    expect((await mcpStartedClient.list()).map((row) => [row.id, row.path])).toEqual([["order-g0200", "/my-orders/group/g0200"]]);
  });
});

describe("a group order she joined", () => {
  it("shows an open one by the product's words with her order line page", async () => {
    answering({
      market_list_group_orders: { items: [groupOrder({ id: "g2", lines: [{ picker: "m1", quantity: 3, answer: "yes" }] })] },
      market_list_offers: { items: [offer] },
    });
    expect(await mcpStartedClient.list()).toEqual([
      { id: "order-g2", workflow: "Group order", title: "Urea 50kg", state: "Open", path: "/my-orders/group/g2" },
    ]);
  });

  it("falls back to the product the result names when offers cannot be read", async () => {
    answering({
      market_list_group_orders: { items: [groupOrder({ lines: [{ picker: "m1", quantity: 3 }] })] },
      market_list_offers: new Error("offers down"),
    });
    expect((await mcpStartedClient.list())[0].title).toBe("urea");
  });

  it("says Revising while new terms are out", async () => {
    answering({
      market_list_group_orders: { items: [groupOrder({ state: "revising", lines: [{ picker: "m1", quantity: 3 }] })] },
    });
    expect((await mcpStartedClient.list())[0].state).toBe("Revising");
  });

  it("leaves out a finished one", async () => {
    answering({
      market_list_group_orders: {
        items: ["sent", "closed", "cancelled"].map((state, n) => groupOrder({ id: `g${n}`, state, lines: [{ picker: "m1", quantity: 3 }] })),
      },
    });
    expect(await mcpStartedClient.list()).toEqual([]);
  });

  it("leaves out a group order that has only someone else's line", async () => {
    answering({ market_list_group_orders: { items: [groupOrder({ lines: [{ picker: "m2", quantity: 3 }] })] } });
    expect(await mcpStartedClient.list()).toEqual([]);
  });

  it("leaves out a sell group order she joined", async () => {
    answering({ market_list_group_orders: { items: [groupOrder({ direction: "sell", lines: [{ picker: "m1", quantity: 3 }] })] } });
    expect(await mcpStartedClient.list()).toEqual([]);
  });
});

describe("a request to join a group", () => {
  const joinable = { items: [{ id: "grp1", name: "Siaya farmers", code: "G-S7F" }] };

  it("shows a pending one by the group's name and sends her to Join", async () => {
    answering({
      actor_list_my_join_requests: { items: [{ group_id: "grp1", state: "pending" }] },
      actor_list_joinable_groups: joinable,
    });
    expect(await mcpStartedClient.list()).toEqual([
      { id: "join-grp1", workflow: "Join a group", title: "Siaya farmers", state: "Requested", path: "/a/farmers/join" },
    ]);
  });

  it("takes the name from her groups when the joinable list lacks it", async () => {
    answering({
      actor_list_my_join_requests: { items: [{ group_id: "grp2", state: "pending" }] },
      actor_list_my_groups: { items: [{ id: "grp2", name: "Bondo farmers" }] },
    });
    expect((await mcpStartedClient.list())[0].title).toBe("Bondo farmers");
  });

  it("keeps the row with no title when no result names the group", async () => {
    answering({ actor_list_my_join_requests: { items: [{ group_id: "grp3", state: "pending" }] } });
    expect(await mcpStartedClient.list()).toEqual([
      { id: "join-grp3", workflow: "Join a group", title: "", state: "Requested", path: "/a/farmers/join" },
    ]);
  });

  it("asks for a group no list names, by its id, and shows the name it gives", async () => {
    const call = answering({
      actor_list_my_join_requests: { items: [{ group_id: "grp3", state: "pending" }] },
      actor_get_group: { id: "grp3", name: "Rarieda growers" },
    });
    expect(await mcpStartedClient.list()).toEqual([
      { id: "join-grp3", workflow: "Join a group", title: "Rarieda growers", state: "Requested", path: "/a/farmers/join" },
    ]);
    expect(call).toHaveBeenCalledWith("", "actor_get_group", { group_id: "grp3" });
  });

  it("asks only for the groups no list names", async () => {
    const call = answering({
      actor_list_my_join_requests: {
        items: [
          { group_id: "grp1", state: "pending" },
          { group_id: "grp3", state: "pending" },
        ],
      },
      actor_list_joinable_groups: joinable,
      actor_get_group: { id: "grp3", name: "Rarieda growers" },
    });
    expect((await mcpStartedClient.list()).map((row) => row.title)).toEqual(["Siaya farmers", "Rarieda growers"]);
    const asked = call.mock.calls.filter(([, tool]) => tool === "actor_get_group").map(([, , args]) => args);
    expect(asked).toEqual([{ group_id: "grp3" }]);
  });

  it("asks once for a group with two pending requests", async () => {
    const call = answering({
      actor_list_my_join_requests: {
        items: [
          { group_id: "grp3", state: "pending" },
          { group_id: "grp3", state: "pending" },
        ],
      },
      actor_get_group: { id: "grp3", name: "Rarieda growers" },
    });
    await mcpStartedClient.list();
    expect(call.mock.calls.filter(([, tool]) => tool === "actor_get_group")).toHaveLength(1);
  });

  it("keeps the row with no title when asking for the group fails", async () => {
    answering({
      actor_list_my_join_requests: { items: [{ group_id: "grp3", state: "pending" }] },
      actor_get_group: new Error("not allowed"),
    });
    expect(await mcpStartedClient.list()).toEqual([
      { id: "join-grp3", workflow: "Join a group", title: "", state: "Requested", path: "/a/farmers/join" },
    ]);
  });

  it("keeps the row when the group names cannot be read", async () => {
    answering({
      actor_list_my_join_requests: { items: [{ group_id: "grp1", state: "pending" }] },
      actor_list_joinable_groups: new Error("down"),
      actor_list_my_groups: new Error("down"),
    });
    expect(await mcpStartedClient.list()).toHaveLength(1);
  });

  it("leaves out a request that was approved or turned down", async () => {
    answering({
      actor_list_my_join_requests: {
        items: [
          { group_id: "grp1", state: "approved" },
          { group_id: "grp2", state: "rejected" },
        ],
      },
      actor_list_joinable_groups: joinable,
    });
    expect(await mcpStartedClient.list()).toEqual([]);
  });
});

describe("her supplier application", () => {
  it("shows one that is not approved yet by the shop name and sends her to Apply", async () => {
    answering({ market_list_posters: { items: [shop()] } });
    expect(await mcpStartedClient.list()).toEqual([
      { id: "supplier-s1", workflow: "Apply as a supplier", title: "Asha Agrovet", state: "Asked", path: "/supply/apply" },
    ]);
  });

  it("leaves out an approved shop", async () => {
    answering({ market_list_posters: { items: [shop({ status: "approved" })] } });
    expect(await mcpStartedClient.list()).toEqual([]);
  });

  it("leaves out an application that was declined or removed", async () => {
    for (const status of ["declined", "removed"]) {
      answering({ market_list_posters: { items: [shop({ status })] } });
      expect(await mcpStartedClient.list()).toEqual([]);
    }
  });

  it("leaves out a shop someone else applied for", async () => {
    answering({ market_list_posters: { items: [shop({ owner: "m2" })] } });
    expect(await mcpStartedClient.list()).toEqual([]);
  });

  it("shows nothing when she cannot be told apart from the other applicants", async () => {
    vi.spyOn(me, "loadSubject").mockResolvedValue("");
    answering({ market_list_posters: { items: [shop({ owner: "" })] } });
    expect(await mcpStartedClient.list()).toEqual([]);
  });
});

describe("every source together", () => {
  const all: Replies = {
    market_list_group_orders: { items: [groupOrder({ id: "g1", coordinator: "m1" }), groupOrder({ id: "g2", lines: [{ picker: "m1", quantity: 1 }] })] },
    market_list_offers: { items: [offer] },
    actor_list_my_join_requests: { items: [{ group_id: "grp1", state: "pending" }] },
    actor_list_joinable_groups: { items: [{ id: "grp1", name: "Siaya farmers" }] },
    market_list_posters: { items: [shop()] },
  };

  it("lists a row from each workflow she has begun", async () => {
    answering(all);
    expect((await mcpStartedClient.list()).map((row) => [row.workflow, row.title])).toEqual([
      ["Create group order", "Urea 50kg"],
      ["Group order", "Urea 50kg"],
      ["Join a group", "Siaya farmers"],
      ["Apply as a supplier", "Asha Agrovet"],
    ]);
  });

  it("keeps the other rows when the group orders cannot be read", async () => {
    answering({ ...all, market_list_group_orders: new Error("market down") });
    expect((await mcpStartedClient.list()).map((row) => row.workflow)).toEqual(["Join a group", "Apply as a supplier"]);
  });

  it("keeps the other rows when the join requests cannot be read", async () => {
    answering({ ...all, actor_list_my_join_requests: new Error("actor down") });
    expect((await mcpStartedClient.list()).map((row) => row.workflow)).toEqual([
      "Create group order",
      "Group order",
      "Apply as a supplier",
    ]);
  });

  it("keeps the other rows when the suppliers cannot be read", async () => {
    answering({ ...all, market_list_posters: new Error("market down") });
    expect((await mcpStartedClient.list()).map((row) => row.workflow)).toEqual([
      "Create group order",
      "Group order",
      "Join a group",
    ]);
  });

  it("rejects with the first failure when every source fails", async () => {
    answering({
      market_list_group_orders: new Error("market down"),
      actor_list_my_join_requests: new Error("actor down"),
      market_list_posters: new Error("market down"),
    });
    await expect(mcpStartedClient.list()).rejects.toThrow("market down");
  });
});

describe("a source that could not be read", () => {
  const all: Replies = {
    market_list_group_orders: { items: [groupOrder({ id: "g1", coordinator: "m1" })] },
    actor_list_my_join_requests: { items: [{ group_id: "grp1", state: "pending" }] },
    actor_list_joinable_groups: { items: [{ id: "grp1", name: "Siaya farmers" }] },
    market_list_posters: { items: [shop()] },
  };

  const failed = async () => (await mcpStartedClient.listWithFailures!()).failed;

  it("names nothing as failed when every source answered", async () => {
    answering(all);
    const answer = await mcpStartedClient.listWithFailures!();
    expect(answer.failed).toEqual([]);
    expect(answer.items.map((row) => row.workflow)).toEqual(["Create group order", "Join a group", "Apply as a supplier"]);
  });

  it("names the group orders as failed and keeps the other rows", async () => {
    answering({ ...all, market_list_group_orders: new Error("market down") });
    const answer = await mcpStartedClient.listWithFailures!();
    expect(answer.failed).toEqual(["orders"]);
    expect(answer.items.map((row) => row.workflow)).toEqual(["Join a group", "Apply as a supplier"]);
  });

  it("names the join requests as failed", async () => {
    answering({ ...all, actor_list_my_join_requests: new Error("actor down") });
    expect(await failed()).toEqual(["joinRequests"]);
  });

  it("names the suppliers as failed", async () => {
    answering({ ...all, market_list_posters: new Error("market down") });
    expect(await failed()).toEqual(["supplier"]);
  });

  it("names two failed sources in the order they are read", async () => {
    answering({ ...all, market_list_group_orders: new Error("market down"), market_list_posters: new Error("market down") });
    expect(await failed()).toEqual(["orders", "supplier"]);
  });

  it("still rejects when every source fails", async () => {
    answering({
      market_list_group_orders: new Error("market down"),
      actor_list_my_join_requests: new Error("actor down"),
      market_list_posters: new Error("market down"),
    });
    await expect(mcpStartedClient.listWithFailures!()).rejects.toThrow("market down");
  });

  it("says it could not tell who she is when the session gives no member", async () => {
    vi.spyOn(me, "loadSubject").mockResolvedValue("");
    answering({ ...all, market_list_posters: { items: [shop({ owner: "" })] } });
    const answer = await mcpStartedClient.listWithFailures!();
    expect(answer.failed).toEqual(["member"]);
    expect(answer.items.map((row) => row.workflow)).toEqual(["Join a group"]);
  });

  it("lists the rows with list() whatever failed", async () => {
    answering({ ...all, market_list_group_orders: new Error("market down") });
    expect((await mcpStartedClient.list()).map((row) => row.workflow)).toEqual(["Join a group", "Apply as a supplier"]);
  });
});

describe("the answer for any client", () => {
  it("takes the failures from a client that reports them", async () => {
    const client: StartedClient = {
      list: async () => [],
      listWithFailures: async () => ({ items: [], failed: ["orders"] }),
    };
    expect(await startedAnswerOf(client)).toEqual({ items: [], failed: ["orders"] });
  });

  it("reports no failures for a client that only lists", async () => {
    const row = { id: "order-g1", workflow: "Group order", title: "urea", state: "Open", path: "/my-orders/group/g1" };
    expect(await startedAnswerOf({ list: async () => [row] })).toEqual({ items: [row], failed: [] });
  });
});
