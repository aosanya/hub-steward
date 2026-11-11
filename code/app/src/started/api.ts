import { coordinatorOrderPath, isLiveBuyOrder } from "../coordinator/start/api";
import { mcpGroupsClient, type GroupsClient } from "../groups/api";
import { applySupplierPath, applySupplierWorkflow, joinGroupPath, joinGroupWorkflow } from "../home/workflowScreens";
import { listAllGroupOrders } from "../market/groupOrders";
import { posterOffersOf, productNameAt, type PosterOffer } from "../market/productName";
import { mcpSupplyClient, mySupplier, resolveMember, type SupplyClient } from "../supply/api";
import { callTool } from "../wakala/mcp";

export type StartedItem = { id: string; workflow: string; title: string; state: string; path: string };

export type StartedSource = "member" | "orders" | "joinRequests" | "supplier";

export type StartedAnswer = { items: StartedItem[]; failed: StartedSource[] };

export type StartedClient = {
  list(): Promise<StartedItem[]>;
  listWithFailures?(): Promise<StartedAnswer>;
};

const workflows = {
  createGroupOrder: "Create group order",
  groupOrder: "Group order",
} as const;

const stateWords = {
  open: "Open",
  revising: "Revising",
  pending: "Requested",
  notApproved: "Asked",
} as const;

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const myOrderPath = (id: string) => `/my-orders/group/${id}`;

const hasLineOf = (raw: any, me: string) =>
  me !== "" && (Array.isArray(raw?.lines) ? raw.lines : []).some((line: any) => text(line?.picker) === me);

const offersOfShops = (): Promise<PosterOffer[]> =>
  callTool("", "market_list_offers", {}).then(posterOffersOf, () => []);

const groupOrderRows = async (me: string): Promise<StartedItem[]> => {
  const live = (await listAllGroupOrders()).filter(isLiveBuyOrder);
  const started = live.filter((raw) => me !== "" && text(raw?.coordinator) === me);
  const joined = live.filter((raw) => !started.includes(raw) && hasLineOf(raw, me));
  const offers = started.length + joined.length > 0 ? await offersOfShops() : [];
  const stateOf = (raw: any) => stateWords[text(raw?.state) as "open" | "revising"];
  const titleOf = (raw: any) => productNameAt(text(raw?.product), text(raw?.poster_id), offers);
  return [
    ...started.map((raw) => ({
      id: `order-${text(raw?.id)}`,
      workflow: workflows.createGroupOrder,
      title: titleOf(raw),
      state: stateOf(raw),
      path: coordinatorOrderPath(text(raw?.id)),
    })),
    ...joined.map((raw) => ({
      id: `order-${text(raw?.id)}`,
      workflow: workflows.groupOrder,
      title: titleOf(raw),
      state: stateOf(raw),
      path: myOrderPath(text(raw?.id)),
    })),
  ];
};

const nameOfGroup = (id: string): Promise<string> =>
  callTool("", "actor_get_group", { group_id: id }).then((reply) => text(reply?.name), () => "");

const joinRequestRows = async (groups: GroupsClient): Promise<StartedItem[]> => {
  const pending = (await groups.listMyJoinRequests()).filter((request) => request.state === "pending");
  if (pending.length === 0) return [];
  const [joinable, mine] = await Promise.all([
    groups.listJoinableGroups().catch(() => []),
    groups.listMyGroups().catch(() => []),
  ]);
  const names = new Map([...mine, ...joinable].map((group) => [group.id, group.name] as const));
  const unnamed = [...new Set(pending.map((request) => request.groupId))].filter((id) => id !== "" && !names.get(id));
  const asked = await Promise.all(unnamed.map(async (id) => [id, await nameOfGroup(id)] as const));
  asked.forEach(([id, name]) => name !== "" && names.set(id, name));
  return pending.map((request) => ({
    id: `join-${request.groupId}`,
    workflow: joinGroupWorkflow,
    title: names.get(request.groupId) ?? "",
    state: stateWords.pending,
    path: joinGroupPath(),
  }));
};

const supplierRows = async (supply: SupplyClient, me: string): Promise<StartedItem[]> => {
  const shop = mySupplier(await supply.listSuppliers(), me);
  if (shop?.status !== "pending") return [];
  return [{ id: `supplier-${shop.id}`, workflow: applySupplierWorkflow, title: shop.shop, state: stateWords.notApproved, path: applySupplierPath }];
};

const sourceNames = ["orders", "joinRequests", "supplier"] as const;

const marketAbsent = (reason: unknown) => reason instanceof Error && reason.message.includes("instance not found");

const emptyWhenNoMarket = <T>(rows: Promise<T[]>): Promise<T[]> =>
  rows.catch((reason) => (marketAbsent(reason) ? [] : Promise.reject(reason)));

const listWithFailures = async (): Promise<StartedAnswer> => {
  const me = await resolveMember();
  const settled = await Promise.allSettled([
    emptyWhenNoMarket(groupOrderRows(me)),
    joinRequestRows(mcpGroupsClient()),
    emptyWhenNoMarket(supplierRows(mcpSupplyClient, me)),
  ]);
  const failures = settled.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (failures.length === settled.length) throw failures[0].reason;
  const failedSources = sourceNames.filter((_, n) => settled[n].status === "rejected");
  return {
    items: settled.flatMap((outcome) => (outcome.status === "fulfilled" ? outcome.value : [])),
    failed: me === "" ? ["member", ...failedSources] : [...failedSources],
  };
};

export const mcpStartedClient: StartedClient = {
  async list() {
    return (await listWithFailures()).items;
  },
  listWithFailures,
};

export const startedAnswerOf = async (client: StartedClient): Promise<StartedAnswer> =>
  client.listWithFailures ? client.listWithFailures() : { items: await client.list(), failed: [] };
