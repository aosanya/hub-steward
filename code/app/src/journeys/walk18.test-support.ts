import { McpError } from "../wakala/mcp";

type Row = Record<string, any>;

export const coordinator = { id: "qa-owner@mwanachama.test", name: "Grace Adhiambo" };
export const agency = { id: "walk-siaya", name: "Siaya Farmers Group" };
export const poster = { id: "p-kisumu", name: "Kisumu Agro Supplies", owner: "hub-supplier@mwanachama.test" };

export const startStep = {
  id: "s1",
  title: "Start the urea group order",
  kind: "fill_form",
  workflow_id: "w1",
  role_id: "r1",
  role_name: "Group coordinator",
  form_name: "Urea group order",
  questions: [
    { prompt: "Product", answer_type: "free_text" },
    { prompt: "Price a bag", answer_type: "currency" },
    { prompt: "Minimum bags", answer_type: "number" },
  ],
};

export const paymentsRecord = {
  code: "RC-1",
  name: "Payments",
  can_add_rows: true,
  questions: [
    { prompt: "Farmer", answer_type: "single_choice", options_from: "members" },
    { prompt: "Amount paid", answer_type: "currency" },
  ],
};

export const farmers = [
  { id: "hub-asha@mwanachama.test", display_name: "Asha Otieno" },
  { id: "hub-baraka@mwanachama.test", display_name: "Baraka Odhiambo" },
  { id: "hub-chebet@mwanachama.test", display_name: "Chebet Kiprop" },
  { id: "hub-kisumu@mwanachama.test", display_name: "Kisumu Grain Traders" },
];

export const freshWorld = () => ({
  membership: "owner",
  caller: coordinator.id,
  coordinatorName: coordinator.name,
  steps: [startStep] as Row[],
  groupOrders: [] as Row[],
  rows: [
    { id: "pr1", order_id: "g1", answers: { Farmer: farmers[0].id, "Amount paid": "7200" } },
    { id: "pr2", order_id: "g1", answers: { Farmer: farmers[1].id, "Amount paid": "3600" } },
    { id: "pr3", order_id: "g1", answers: { Farmer: farmers[2].id, "Amount paid": "7200" } },
  ] as Row[],
  saved: [] as string[],
  notifications: [] as Row[],
  calls: [] as Array<[string, Row]>,
});

export type World = ReturnType<typeof freshWorld>;

const orderAsSeen = (order: Row) => ({ ...order, lines: [] });

export const reply = (world: World) => async (_hub: string, tool: string, args: Row = {}): Promise<any> => {
  world.calls.push([tool, args]);
  switch (tool) {
    case "agency_list_instances":
      return { items: [agency] };
    case "agency_get_agency":
      return { id: agency.id, name: agency.name };
    case "agency_list_mounts":
      return { modules: [] };
    case "market_list_posters":
      return { items: [{ id: poster.id, name: poster.name, owner: poster.owner, status: "approved" }] };
    case "agency_list_my_open_steps":
      return { items: world.membership === "owner" ? world.steps : [] };
    case "agency_get_my_roles":
      return { instance_id: agency.id, membership: world.membership, roles: [] };
    case "market_get_group_order_poster":
      return { poster_id: poster.id, poster_name: poster.name };
    case "market_start_group_order": {
      const order = {
        id: "g1",
        poster_id: args.poster_id,
        coordinator: coordinator.id,
        product: args.product,
        direction: "buy",
        state: "open",
        price: args.price,
        minimum: args.minimum,
        terms_version: 1,
        terms_history: JSON.stringify([{ version: 1, price: args.price, minimum: args.minimum }]),
        total: 0,
        count: 0,
      };
      world.groupOrders.push(order);
      return order;
    }
    case "market_list_group_orders":
      return { items: world.groupOrders.map(orderAsSeen) };
    case "market_get_group_order":
      return orderAsSeen(world.groupOrders.find((g) => g.id === args.groupOrderID)!);
    case "market_send_group_order": {
      const order = world.groupOrders.find((g) => g.id === args.groupOrderID)!;
      order.state = "sent";
      return order;
    }
    case "agency_list_live_records":
      return { items: [{ ...paymentsRecord, can_add_rows: world.membership === "owner" }] };
    case "actor_list_actors":
      return { items: [{ id: coordinator.id, display_name: world.coordinatorName }, ...farmers] };
    case "agency_list_live_record_rows":
      return { items: world.rows.filter((r) => r.order_id === args.order_id && !r.replaced && (world.membership === "owner" || r.answers.Farmer === world.caller)) };
    case "agency_add_live_record_row": {
      const key = JSON.stringify([args.order_id, args.answers, args.replaces ?? ""]);
      if (world.saved.includes(key)) throw new McpError("agency_add_live_record_row: mwanachamaagency: the same answers were saved a moment ago");
      world.saved.push(key);
      const earlier = world.rows.find((r) => r.id === args.replaces);
      if (earlier) earlier.replaced = true;
      const row = {
        id: `pr${world.rows.length + 1}`,
        order_id: args.order_id,
        answers: args.answers,
        ...(earlier ? { corrected_on: "2026-11-02T09:30:00Z" } : {}),
      };
      world.rows.push(row);
      return row;
    }
    case "comm_notification_list":
      return { items: world.notifications };
    case "comm_notification_mark_read":
      return { marked: 0 };
    case "actor_list_my_invitations":
      return { items: [] };
    default:
      throw new Error(`the walk has no answer for ${tool}`);
  }
};

export const callsTo = (world: World, tool: string) => world.calls.filter(([name]) => name === tool).map(([, args]) => args);
