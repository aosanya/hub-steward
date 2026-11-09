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

async function removeSteps(progress: Progress, id: string, draft: DraftStep[], original: BacklogDetail, current: BacklogDetail): Promise<BacklogDetail> {
  let latest = current;
  for (const gone of original.steps.filter((saved) => !draft.some((kept) => kept.id === saved.id))) {
    latest = detailOf(await step(progress, `removed ${gone.name}`, `Could not remove ${gone.name}`, callTool("", backlogTools.removeStep, { ...ofBacklog(id), stepID: gone.id })));
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
    const after = order[order.length - 1] ?? "";
    latest = detailOf(await step(progress, `added ${wanted.name}`, `Could not add ${wanted.name}`, callTool("", backlogTools.addStep, { ...ofBacklog(id), name: wanted.name, after })));
    order.push(idOfNewest(before, latest, wanted.name));
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
  const subject = await loadSubject();
  if (subject === "") return false;
  const reply = await callTool("", backlogTools.mayPerform, { subject, scope: openAgencyId(), action: manageAction });
  return allowedIn(reply);
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
    const progress: Progress = { saved: [] };
    if (name !== current.name) await step(progress, "renamed the backlog", "Could not rename the backlog", callTool("", backlogTools.rename, { ...ofBacklog(id), name }));
    const { latest, order } = await addSteps(progress, id, draft, current);
    const afterRemoval = await removeSteps(progress, id, draft, current, latest);
    const currentOrder = afterRemoval.steps.map((one) => one.id);
    if (order.join() !== currentOrder.join()) await step(progress, "reordered the steps", "Could not reorder the steps", callTool("", backlogTools.reorder, { ...ofBacklog(id), steps: order }));
  },
  async remove(id) {
    await refused(callTool("", backlogTools.remove, ofBacklog(id)));
  },
};
