import { agencyInstanceAbsent, hasModule, mcpAgencyClient, taskModule, type AgencyClient, type AgencyView } from "../../features/agency/modules";
import { holdsPermission, useMyPermissions, type MyAccess } from "../../features/agency/useMyPermissions";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { type Backlog, type BacklogsClient, mcpBacklogsClient } from "../../features/backlogs";
import { mcpFilesClient, type FilesClient } from "../../features/files";
import { mcpStartClient, type StartClient, type StartStep } from "../../features/market";
import { useLoad, type Loaded } from "../../features/forms/useLoad";
import { mcpStepsClient, type StepsClient } from "../../features/steps/api";
import { loadRecordWorkflows } from "../menu/declaredRecord";
import { everyNode, type HomeNode } from "./homeDeclaration";

export type HomeWiring = {
  agency?: AgencyClient;
  start?: Pick<StartClient, "openSteps">;
  steps?: Pick<StepsClient, "available">;
  backlogs?: Pick<BacklogsClient, "backlogs">;
  mayRead?: () => Promise<boolean>;
  files?: Pick<FilesClient, "mounted">;
};

export type HomeFacts = {
  access: MyAccess;
  view: AgencyView | null;
  backlogs: Backlog[];
  filesMounted: boolean;
  holdsWorkflows: boolean;
  openSteps: StartStep[];
  recordWorkflows: Record<string, string>;
};

const readPermission = "task.read";

const typesIn = (nodes: HomeNode[]) => new Set(everyNode(nodes).flatMap((node) => (node.target ? [node.target.type] : [])));

const readView = async (agency: AgencyClient): Promise<AgencyView | null> => {
  const view = await agency.read().catch((reason) => {
    if (agencyInstanceAbsent(reason)) return null;
    throw reason;
  });
  if (view?.modulesUnread) throw new Error("modules unread");
  return view;
};

const readWorkflows = async (start: Clients["start"], steps: Clients["steps"]) => {
  const [open, available] = await Promise.allSettled([start.openSteps(), steps.available()]);
  const openSteps = open.status === "fulfilled" ? open.value : [];
  const held = openSteps.length + (available.status === "fulfilled" ? available.value.length : 0);
  if (held === 0 && (open.status === "rejected" || available.status === "rejected")) throw new Error("workflows unread");
  return { openSteps, holdsWorkflows: held > 0 };
};

const readBacklogs = async (view: AgencyView | null, access: MyAccess, backlogs: Clients["backlogs"]) =>
  view && hasModule(view, taskModule) && holdsPermission(access, readPermission) ? backlogs.backlogs() : [];

type Clients = Required<Omit<HomeWiring, "mayRead">>;

const noWorkflows = { openSteps: [] as StartStep[], holdsWorkflows: false };

const readFacts = async (nodes: HomeNode[], access: MyAccess, clients: Clients): Promise<HomeFacts> => {
  const types = typesIn(nodes);
  const needs = (...kinds: string[]) => kinds.some((kind) => types.has(kind));
  const view = needs("backlog", "menu") ? await readView(clients.agency) : null;
  const [held, backlogs, filesMounted, recordWorkflows] = await Promise.all([
    needs("workflow", "start", "ongoing") ? readWorkflows(clients.start, clients.steps) : Promise.resolve(noWorkflows),
    needs("backlog") ? readBacklogs(view, access, clients.backlogs) : Promise.resolve([]),
    needs("files") ? clients.files.mounted() : Promise.resolve(false),
    needs("record") && needs("workflow") ? loadRecordWorkflows().catch((): Record<string, string> => ({})) : Promise.resolve<Record<string, string>>({}),
  ]);
  return { access, view, backlogs, filesMounted, recordWorkflows, ...held };
};

const clientsOf = (wiring: HomeWiring): Clients => ({
  agency: wiring.agency ?? mcpAgencyClient,
  start: wiring.start ?? mcpStartClient,
  steps: wiring.steps ?? mcpStepsClient,
  backlogs: wiring.backlogs ?? mcpBacklogsClient,
  files: wiring.files ?? mcpFilesClient,
});

export const permissionsFailedWords = "Your permissions could not be read.";

export const readsFailedWords = "Home could not check everything it needs.";

export type HomeFactsState = Exclude<Loaded<HomeFacts>, { state: "error" }> | { state: "error"; words: string };

export function useHomeFacts(nodes: HomeNode[], wiring: HomeWiring, attempt: number): HomeFactsState {
  const access = useMyPermissions(attempt);
  const held = useLoad(() => (access.state === "ready" ? readFacts(nodes, access.data, clientsOf(wiring)) : Promise.resolve(null)), `home-facts:${openAgencyId()}:${attempt}:${access.state}`);
  if (access.state === "error") return { state: "error", words: permissionsFailedWords };
  if (held.state === "error") return { state: "error", words: readsFailedWords };
  if (held.state !== "ready" || held.data === null) return { state: "loading" };
  return { state: "ready", data: held.data };
}
