import { openAgencyId } from "../agency/open";
import { callTool, McpError } from "../wakala/mcp";
import { loadSubject } from "../wakala/me";
import { savedStep, type DraftStep } from "./stepsDraft";
import { ManageRefused, type BacklogDetail, type BacklogManageClient } from "./types";

export const backlogTools = {
  list: "taskmanager_backlog_list",
  create: "taskmanager_backlog_create",
  rename: "taskmanager_backlog_rename",
  remove: "taskmanager_backlog_delete",
  addStep: "taskmanager_backlog_step_add",
  removeStep: "taskmanager_backlog_step_remove",
  reorder: "taskmanager_backlog_step_reorder",
  mayPerform: "permissions_check_read",
};

export const manageAction = "taskmanager.backlog.manage";

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const detailOf = (raw: any): BacklogDetail => ({
  id: text(raw?.id),
  name: text(raw?.name),
  steps: (Array.isArray(raw?.steps) ? raw.steps : []).map((step: any) => savedStep(text(step?.id), text(step?.name), typeof step?.issues === "number" ? step.issues : 0)),
});

export const allowedIn = (reply: any) => reply === true || [reply?.allowed, reply?.may, reply?.result, reply?.value].includes(true);

const refusalText = (error: unknown) => {
  const message = error instanceof McpError ? error.message : "";
  const colon = message.indexOf(": ");
  return colon >= 0 ? message.slice(colon + 2) : message;
};

const refused = async <T>(call: Promise<T>): Promise<T> => {
  try {
    return await call;
  } catch (error) {
    throw new ManageRefused(refusalText(error));
  }
};

const ofBacklog = (id: string) => ({ backlogID: id });

const idOfNewest = (before: DraftStep[], after: BacklogDetail, name: string) =>
  [...after.steps].reverse().find((step) => step.name === name && !before.some((known) => known.id === step.id))?.id ?? "";

async function removeSteps(id: string, draft: DraftStep[], current: BacklogDetail): Promise<BacklogDetail> {
  let latest = current;
  for (const step of current.steps.filter((saved) => !draft.some((kept) => kept.id === saved.id))) {
    latest = detailOf(await refused(callTool("", backlogTools.removeStep, { ...ofBacklog(id), stepID: step.id })));
  }
  return latest;
}

async function addSteps(id: string, draft: DraftStep[], current: BacklogDetail): Promise<{ latest: BacklogDetail; order: string[] }> {
  let latest = current;
  const order: string[] = [];
  for (const step of draft) {
    if (step.id !== "") {
      order.push(step.id);
      continue;
    }
    const before = latest.steps;
    latest = detailOf(await refused(callTool("", backlogTools.addStep, { ...ofBacklog(id), name: step.name, after: order[order.length - 1] ?? "" })));
    order.push(idOfNewest(before, latest, step.name));
  }
  return { latest, order };
}

const readBacklog = async (id: string) => {
  const reply = await callTool("", backlogTools.list, {});
  const found = (Array.isArray(reply?.items) ? reply.items : []).map(detailOf).find((one: BacklogDetail) => one.id === id);
  if (!found) throw new ManageRefused("This backlog could not be found.");
  return found;
};

export const mcpBacklogManageClient: BacklogManageClient = {
  async mayManage() {
    const subject = await loadSubject();
    if (subject === "") return false;
    const reply = await callTool("", backlogTools.mayPerform, { subject, scope: openAgencyId(), action: manageAction });
    return allowedIn(reply);
  },
  read: readBacklog,
  async create(name, steps) {
    const reply = await refused(callTool("", backlogTools.create, { name, steps }));
    return text(reply?.id);
  },
  async save(id, name, draft) {
    const current = await readBacklog(id);
    if (name !== current.name) await refused(callTool("", backlogTools.rename, { ...ofBacklog(id), name }));
    const afterRemoval = await removeSteps(id, draft, current);
    const { latest, order } = await addSteps(id, draft, afterRemoval);
    const currentOrder = latest.steps.map((step) => step.id);
    if (order.join() !== currentOrder.join()) await refused(callTool("", backlogTools.reorder, { ...ofBacklog(id), steps: order }));
  },
  async remove(id) {
    await refused(callTool("", backlogTools.remove, ofBacklog(id)));
  },
};
