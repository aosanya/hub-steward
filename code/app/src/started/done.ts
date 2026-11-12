import { coordinatorOrderPath } from "../coordinator/start/api";
import { productNameAt, type PosterOffer } from "../market/productName";
import { resolveMember } from "../supply/api";
import { callTool } from "../wakala/mcp";
import { marketAbsent, offersOfShops } from "./api";

export const donePageSize = 20;

export type DoneItem = { id: string; workflow: string; title: string; state: string; endedAt: string; path: string };

export const doneSources = ["sentSteps", "closedGroupOrders", "calledOffGroupOrders", "deliveredOrders", "calledOffOrders"] as const;

export type DoneSource = (typeof doneSources)[number];

export type DoneCursor = Record<DoneSource, string | null>;

export type DonePage = { items: DoneItem[]; failed: DoneSource[]; next: DoneCursor | null };

export type DoneClient = { read(after: DoneCursor | null): Promise<DonePage> };

type SourcePage = { items: DoneItem[]; last: string; full: boolean };

type SourceRead = (after: string, me: string) => Promise<SourcePage>;

const states = { closed: "Closed", calledOff: "Called off", delivered: "Delivered", sent: "Sent" } as const;

const workflows = { createGroupOrder: "Create group order", groupOrder: "Group order", order: "Order", form: "Form" } as const;

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

const pageArguments = (after: string, rest: Record<string, unknown> = {}) => ({
  ...rest,
  limit: donePageSize,
  ...(after === "" ? {} : { after }),
});

const pageOf = (rows: any[], idKey: string, items: DoneItem[]): SourcePage => ({
  items,
  last: text(rows[rows.length - 1]?.[idKey]),
  full: rows.length >= donePageSize,
});

const noMarketPage: SourcePage = { items: [], last: "", full: false };

const emptyWhenNoMarket = (page: Promise<SourcePage>) =>
  page.catch((reason) => (marketAbsent(reason) ? noMarketPage : Promise.reject(reason)));

const groupOrdersEnded =
  (state: "closed" | "cancelled", words: string, endKey: "closed_at" | "cancelled_at"): SourceRead =>
  (after, me) =>
    emptyWhenNoMarket(
      callTool("", "market_list_group_orders", pageArguments(after, { mine: true, state })).then(async (reply) => {
        const rows = itemsOf(reply);
        const buys = rows.filter((raw) => text(raw?.direction) === "buy");
        const offers: PosterOffer[] = buys.length > 0 ? await offersOfShops() : [];
        return pageOf(
          rows,
          "id",
          buys.map((raw) => {
            const started = me !== "" && text(raw?.coordinator) === me;
            return {
              id: `order-${text(raw?.id)}`,
              workflow: started ? workflows.createGroupOrder : workflows.groupOrder,
              title: productNameAt(text(raw?.product), text(raw?.poster_id), offers),
              state: words,
              endedAt: text(raw?.[endKey]),
              path: started ? coordinatorOrderPath(text(raw?.id)) : `/my-orders/group/${text(raw?.id)}`,
            };
          }),
        );
      }),
    );

const ordersEnded =
  (state: "delivered" | "cancelled", words: string, endKey: "delivered_at" | "cancelled_at"): SourceRead =>
  (after) =>
    emptyWhenNoMarket(
      callTool("", "market_list_orders", pageArguments(after, { state })).then((reply) => {
        const rows = itemsOf(reply);
        return pageOf(
          rows,
          "id",
          rows.map((raw) => ({
            id: `single-${text(raw?.id)}`,
            workflow: workflows.order,
            title: text(raw?.product),
            state: words,
            endedAt: text(raw?.[endKey]),
            path: `/my-orders/${text(raw?.id)}`,
          })),
        );
      }),
    );

const sentSteps: SourceRead = async (after) => {
  const rows = itemsOf(await callTool("", "agency_list_my_sent_steps", pageArguments(after)));
  return pageOf(
    rows,
    "row_id",
    rows.map((raw) => ({
      id: `form-${text(raw?.row_id)}`,
      workflow: workflows.form,
      title: text(raw?.title) || text(raw?.form_name),
      state: states.sent,
      endedAt: text(raw?.sent_at),
      path: "",
    })),
  );
};

const sources: Record<DoneSource, SourceRead> = {
  sentSteps,
  closedGroupOrders: groupOrdersEnded("closed", states.closed, "closed_at"),
  calledOffGroupOrders: groupOrdersEnded("cancelled", states.calledOff, "cancelled_at"),
  deliveredOrders: ordersEnded("delivered", states.delivered, "delivered_at"),
  calledOffOrders: ordersEnded("cancelled", states.calledOff, "cancelled_at"),
};

const startCursor: DoneCursor = {
  sentSteps: "",
  closedGroupOrders: "",
  calledOffGroupOrders: "",
  deliveredOrders: "",
  calledOffOrders: "",
};

const endedTime = (item: DoneItem) => {
  const time = Date.parse(item.endedAt);
  return Number.isNaN(time) ? -Infinity : time;
};

export const newestFirst = (items: DoneItem[]) => [...items].sort((a, b) => endedTime(b) - endedTime(a));

const read = async (after: DoneCursor | null): Promise<DonePage> => {
  const me = await resolveMember();
  const cursor = after ?? startCursor;
  const asked = doneSources.filter((source) => cursor[source] !== null);
  const settled = await Promise.allSettled(asked.map((source) => sources[source](cursor[source] as string, me)));
  const failures = settled.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (asked.length > 0 && failures.length === settled.length) throw failures[0].reason;
  const next = { ...cursor };
  asked.forEach((source, n) => {
    const outcome = settled[n];
    if (outcome.status === "fulfilled") next[source] = outcome.value.full ? outcome.value.last : null;
  });
  return {
    items: newestFirst(settled.flatMap((outcome) => (outcome.status === "fulfilled" ? outcome.value.items : []))),
    failed: asked.filter((_, n) => settled[n].status === "rejected"),
    next: doneSources.every((source) => next[source] === null) ? null : next,
  };
};

export const mcpDoneClient: DoneClient = { read };
