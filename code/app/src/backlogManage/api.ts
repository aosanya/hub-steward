import { callTool, McpError } from "../wakala/mcp";
import { savePlan, type Rename } from "./savePlan";
import { savedStep, type DraftStep } from "./stepsDraft";
import { ManageRefused, type BacklogDetail, type BacklogManageClient } from "./types";

export const backlogTools = {
  list: "taskmanager_backlog_list",
  create: "taskmanager_backlog_create",
  rename: "taskmanager_backlog_rename",
  remove: "taskmanager_backlog_delete",
  addStep: "taskmanager_backlog_step_add",
  renameStep: "taskmanager_backlog_step_rename",
  removeStep: "taskmanager_backlog_step_remove",
  reorder: "taskmanager_backlog_step_reorder",
  myRoles: "agency_get_my_roles",
};

export const managePermission = "backlog.manage";

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const detailOf = (raw: any): BacklogDetail => ({
  id: text(raw?.id),
  name: text(raw?.name),
  steps: (Array.isArray(raw?.steps) ? raw.steps : []).map((step: any) => savedStep(text(step?.id), text(step?.name), typeof step?.issues === "number" ? step.issues : 0)),
});

export const allowedIn = (reply: any) => Array.isArray(reply?.permissions) && reply.permissions.includes(managePermission);

export const refusalText = (error: unknown) => {
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

type Progress = { saved: string[] };

const step = async <T>(progress: Progress, done: string, failed: string, call: Promise<T>): Promise<T> => {
  try {
    const reply = await call;
    progress.saved.push(done);
    return reply;
  } catch (error) {
    const saved = progress.saved.length === 0 ? "Nothing was saved." : `Saved so far: ${progress.saved.join(", ")}.`;
    throw new ManageRefused(`${failed}: ${refusalText(error)} ${saved}`);
  }
};

async function removeSteps(progress: Progress, id: string, removed: DraftStep[], current: BacklogDetail): Promise<BacklogDetail> {
  let latest = current;
  for (const gone of removed) {
    latest = detailOf(await step(progress, `removed ${gone.name}`, `Could not remove ${gone.name}`, callTool("", backlogTools.removeStep, { ...ofBacklog(id), stepID: gone.id })));
  }
  return latest;
}

async function renameSteps(progress: Progress, id: string, renames: Rename[], current: BacklogDetail): Promise<BacklogDetail> {
  let latest = current;
  for (const one of renames) {
    latest = detailOf(await step(progress, `renamed ${one.from} to ${one.to}`, `Could not rename ${one.from}`, callTool("", backlogTools.renameStep, { ...ofBacklog(id), stepID: one.id, name: one.to })));
  }
  return latest;
}

async function addSteps(progress: Progress, id: string, draft: DraftStep[], current: BacklogDetail): Promise<{ latest: BacklogDetail; order: string[] }> {
  let latest = current;
  const order: string[] = [];
  for (const wanted of draft) {
    if (wanted.id !== "") {
      order.push(wanted.id);
      continue;
    }
    const before = latest.steps;
    const name = wanted.name.trim();
    const after = order[order.length - 1] ?? "";
    latest = detailOf(await step(progress, `added ${name}`, `Could not add ${name}`, callTool("", backlogTools.addStep, { ...ofBacklog(id), name, after })));
    order.push(idOfNewest(before, latest, name));
  }
  return { latest, order };
}

const readBacklog = async (id: string) => {
  const reply = await callTool("", backlogTools.list, {});
  const found = (Array.isArray(reply?.items) ? reply.items : []).map(detailOf).find((one: BacklogDetail) => one.id === id);
  if (!found) throw new ManageRefused("This backlog could not be found.");
  return found;
};

async function askMayManage(): Promise<boolean> {
  return allowedIn(await callTool("", backlogTools.myRoles));
}

export const mcpBacklogManageClient: BacklogManageClient = {
  mayManage: askMayManage,
  read: readBacklog,
  async create(name, steps) {
    const reply = await refused(callTool("", backlogTools.create, { name, steps }));
    return text(reply?.id);
  },
  async save(id, name, draft) {
    const current = await readBacklog(id);
    const plan = savePlan(current, draft);
    if (plan.problem !== "") throw new ManageRefused(`${plan.problem} Nothing was saved.`);
    const progress: Progress = { saved: [] };
    if (name !== current.name) await step(progress, "renamed the backlog", "Could not rename the backlog", callTool("", backlogTools.rename, { ...ofBacklog(id), name }));
    let latest: BacklogDetail = current;
    if (!plan.replacesAll) {
      latest = await removeSteps(progress, id, plan.removed, latest);
      latest = await renameSteps(progress, id, plan.renames, latest);
    }
    const added = await addSteps(progress, id, plan.draft, latest);
    latest = added.latest;
    if (plan.replacesAll) latest = await removeSteps(progress, id, plan.removed, latest);
    const currentOrder = latest.steps.map((one) => one.id);
    if (added.order.join() !== currentOrder.join()) await step(progress, "reordered the steps", "Could not reorder the steps", callTool("", backlogTools.reorder, { ...ofBacklog(id), steps: added.order }));
  },
  async remove(id) {
    await refused(callTool("", backlogTools.remove, ofBacklog(id)));
  },
};
