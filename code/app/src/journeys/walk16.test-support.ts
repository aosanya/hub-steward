import { farmerChatSteps } from "./chatSteps";

type Row = Record<string, any>;

export const farmer = { id: "f1", name: "Asha Otieno" };
export const buyer = { id: "bu1", poster: "b1", name: "Kisumu Grain Traders" };

export const world = (callerOf: () => string) => {
  const store = {
    posters: [
      { id: "b1", name: buyer.name, owner: buyer.id, status: "approved" },
      { id: "b2", name: "Siaya Millers", owner: "bu2", status: "approved" },
    ] as Row[],
    offers: [
      { id: "o1", poster_id: "b1", product: "maize", product_words: "Dry maize 90kg", unit_words: "bag", price: 4200, bulk_min: 100, bulk_price: 4350 },
      { id: "o2", poster_id: "b2", product: "maize", product_words: "MAIZE grain (bag)", unit_words: "bag", price: 3900, bulk_min: 0, bulk_price: 0 },
    ] as Row[],
    groupOrders: [
      {
        id: "g1",
        poster_id: "b1",
        product: "maize",
        price: 4350,
        minimum: 100,
        state: "open",
        direction: "sell",
        total: 62,
        count: 6,
        lines: [{ picker: "f9", quantity: 17 }] as Row[],
      },
    ] as Row[],
    orders: [] as Row[],
    asks: [] as Row[],
    requests: [] as Row[],
    yeses: [] as Row[],
    calls: [] as Array<[string, Row]>,
  };

  const groupView = (g: Row) => ({
    id: g.id,
    poster_id: g.poster_id,
    product: g.product,
    price: g.price,
    minimum: g.minimum,
    state: g.state,
    promised_date: g.promised_date,
    direction: g.direction,
    total: g.total,
    count: g.count,
    lines: g.lines.filter((line: Row) => line.picker === callerOf()),
  });

  const ownsPoster = (posterId: string) => store.posters.some((p) => p.id === posterId && p.owner === callerOf());

  const call = async (_hub: string, tool: string, args: Row = {}): Promise<any> => {
    store.calls.push([tool, args]);
    switch (tool) {
      case "market_list_posters":
        return { items: store.posters.filter((p) => !args.status || p.status === args.status) };
      case "market_list_offers":
        return { items: store.offers.filter((o) => !args.poster_id || o.poster_id === args.poster_id) };
      case "market_create_offer":
        store.offers.push({ id: `o${store.offers.length + 1}`, ...args });
        return {};
      case "market_list_group_orders":
        return { items: store.groupOrders.map(groupView) };
      case "market_get_group_order":
        return groupView(store.groupOrders.find((g) => g.id === args.groupOrderID)!);
      case "market_join_group_order": {
        const group = store.groupOrders.find((g) => g.id === args.groupOrderID)!;
        group.lines.push({ picker: callerOf(), quantity: args.quantity });
        group.total += args.quantity;
        group.count += 1;
        return {};
      }
      case "market_create_wanted": {
        const made = { id: `r${store.requests.length + 1}`, wanted: args.wanted, quantity: args.quantity };
        store.requests.push(made);
        return made;
      }
      case "market_ask": {
        const made = {
          id: `a${store.asks.length + 1}`,
          request_id: args.request_id,
          poster_id: args.poster_id,
          offer_id: args.offer_id,
          kind: args.kind,
          product: args.product,
          picker: callerOf(),
          picker_name: farmer.name,
          question: args.question,
          detail: "",
          answer: "waiting",
        };
        store.asks.push(made);
        return made;
      }
      case "market_list_asks":
        return { items: store.asks.filter((a) => ownsPoster(a.poster_id) || a.picker === callerOf()) };
      case "market_answer_ask": {
        const ask = store.asks.find((a) => a.id === args.askID)!;
        ask.answer = args.answer;
        if (args.answer === "yes") {
          store.yeses.push({ id: `y${store.yeses.length + 1}`, ask_id: ask.id, poster_id: ask.poster_id, picker: ask.picker, date: args.date, note: args.note, state: "open" });
        }
        return {};
      }
      case "market_list_yeses":
        return { items: store.yeses.filter((y) => y.picker === callerOf() || ownsPoster(y.poster_id)) };
      case "market_buy_now": {
        const offer = store.offers.find((o) => o.id === (args.offerID ?? args.offer_id))!;
        const yes = store.yeses.find((y) => y.id === args.yes_id);
        const order = {
          id: `or${store.orders.length + 1}`,
          poster_id: offer.poster_id,
          picker: callerOf(),
          offer_id: offer.id,
          yes_id: yes?.id ?? "",
          product: offer.product,
          quantity: args.quantity,
          unit_price: offer.price,
          state: "placed",
          promised_date: yes?.date ?? "",
        };
        store.orders.push(order);
        return order;
      }
      case "market_list_orders":
        return { items: store.orders.filter((o: Row) => o.picker === callerOf()) };
      case "market_get_order":
        return store.orders.find((o) => o.id === (args.orderID ?? args.order_id))!;
      case "market_cancel_order": {
        const order = store.orders.find((o) => o.id === args.orderID)!;
        order.state = "cancelled";
        return order;
      }
      case "market_withdraw_ask": {
        store.asks.find((a) => a.id === args.askID)!.answer = "withdrawn";
        return {};
      }
      case "agency_list_my_open_steps":
        return { items: farmerChatSteps };
      default:
        throw new Error(`the walk has no answer for ${tool}`);
    }
  };

  const groupSaleConfirmed = () => {
    const group = store.groupOrders[0];
    group.state = "closed";
    group.promised_date = "2026-11-06";
  };

  return { store, call, groupSaleConfirmed };
};
