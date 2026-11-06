import { agencyBasePath, openAgencyId } from "./agency/open";
import { agencyRoute, chatTab, doSomethingTab, tabPathIn } from "./tabs";

type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

type Values<P extends string> = { [Name in ParamNames<P>]: string };

type Query = Record<string, string>;

type Given = Record<string, string | undefined>;

type BuildArguments<P extends string> = [ParamNames<P>] extends [never] ? [query?: Query] : [values: Values<P>, query?: Query];

export type AgencyScreen = {
  retired: string;
  pattern: string;
  pathIn: (agencyId: string, values: Given, query?: Query) => string;
};

type Screen<P extends string> = Omit<AgencyScreen, "retired"> & { retired: P; path: (...given: BuildArguments<P>) => string };

const filled = (pattern: string, values: Given) => pattern.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(values[name] ?? ""));

const withQuery = (path: string, query?: Query) => {
  const search = new URLSearchParams(query).toString();
  return search ? `${path}?${search}` : path;
};

function screen<P extends string>(retired: P): Screen<P> {
  const hasValues = retired.includes(":");
  const pathIn = (agencyId: string, values: Given, query?: Query) => {
    const tail = filled(retired, values);
    return withQuery(agencyId ? `${agencyBasePath(agencyId)}${tail}` : tail, query);
  };
  const path = (...given: BuildArguments<P>) => {
    const [values, query] = hasValues ? (given as [Given, Query?]) : [{}, given[0] as Query | undefined];
    return pathIn(openAgencyId(), values, query);
  };
  return { retired, pattern: `${agencyRoute}${retired}`, pathIn, path };
}

export const routes = {
  join: screen("/join"),
  start: screen("/start/:stepId"),
  step: screen("/steps/:stepId"),
  market: screen("/market"),
  product: screen("/market/:productId"),
  buyNow: screen("/market/:productId/buy/:offerId"),
  marketOrder: screen("/market/orders/:orderId"),
  boughtOrder: screen("/market/bought/:orderId"),
  groupOrder: screen("/market/:productId/group-orders/:groupOrderId"),
  joinGroupOrder: screen("/market/:productId/group-orders/:groupOrderId/join"),
  forms: screen("/forms"),
  form: screen("/forms/:id"),
  roomThreads: screen("/chat/:roomId/threads"),
  roomThread: screen("/chat/:roomId/:threadId"),
  ask: screen("/chat/:roomId/:threadId/asks/:askId"),
};

export const allScreens: AgencyScreen[] = Object.values(routes);

export const doSomethingPath = () => tabPathIn(doSomethingTab, openAgencyId());

export const chatListPath = () => tabPathIn(chatTab, openAgencyId());
