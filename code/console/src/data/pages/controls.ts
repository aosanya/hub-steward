import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { ActionRun, PageModule, Query } from "../types";
import { itemsOf, textOf, trimmedValue } from "./groups";

export type Control = {
  id: string;
  code: string;
  text: string;
  strength: string;
  action: string;
  onBreach: string;
  severity: string;
  attachedTo: string;
};

const attachedLabel = (attachment: Record<string, unknown>) =>
  [textOf(attachment, "target_type"), textOf(attachment, "target_code")].filter((part) => part !== "").join(" ");

const strengthOf = (item: Record<string, unknown>) => textOf(item, "strength") || (textOf(item, "action") ? "enforced" : "advisory");

const attachedTo = async (hubId: string, controlId: string) =>
  itemsOf(await callTool<unknown>(hubId, "agency_list_control_attachments", { control_id: controlId }))
    .map(attachedLabel)
    .filter((label) => label !== "")
    .join(", ");

export const listControls = async (hubId: string, query: Query = {}): Promise<Control[]> => {
  const items = itemsOf(await callTool<unknown>(hubId, "agency_list_controls", await draftScope(hubId, query)));
  return Promise.all(
    items.map(async (item) => ({
      id: textOf(item, "id"),
      code: textOf(item, "code"),
      text: textOf(item, "text"),
      strength: strengthOf(item),
      action: textOf(item, "action"),
      onBreach: textOf(item, "on_breach"),
      severity: textOf(item, "severity"),
      attachedTo: await attachedTo(hubId, textOf(item, "id")),
    })),
  );
};

const fieldNames = ["code", "text", "action", "cond_field", "cond_operator", "cond_value", "on_breach", "workflow_id", "severity"];

const fieldsOf = (values: Record<string, unknown>) => {
  const fields: Record<string, string> = {};
  for (const name of fieldNames) fields[name] = trimmedValue(values, name);
  return fields;
};

const required = (values: Record<string, unknown>, key: string) => {
  const value = trimmedValue(values, key);
  if (!value) throw new Error(key + " is required");
  return value;
};

export const createControl: ActionRun = async (hubId, values) => {
  const fields = fieldsOf(values);
  if (!fields.text) throw new Error("text is required");
  const scope = await draftScope(hubId, { draft_id: trimmedValue(values, "draft_id") });
  await callTool(hubId, "agency_create_control", { ...scope, ...fields });
  return "done";
};

export const updateControl: ActionRun = async (hubId, values) => {
  const controlId = required(values, "control_id");
  const fields = fieldsOf(values);
  if (!fields.text) throw new Error("text is required");
  await callTool(hubId, "agency_update_control", { control_id: controlId, ...fields });
  return "done";
};

export const deleteControl: ActionRun = async (hubId, values) => {
  await callTool(hubId, "agency_delete_control", { control_id: required(values, "control_id") });
  return "done";
};

export const attachControl: ActionRun = async (hubId, values) => {
  await callTool(hubId, "agency_attach_control", {
    control_id: required(values, "control_id"),
    target_type: required(values, "target_type"),
    target_id: required(values, "target_id"),
  });
  return "done";
};

export const detachControl: ActionRun = async (hubId, values) => {
  await callTool(hubId, "agency_detach_control", { attachment_id: required(values, "attachment_id") });
  return "done";
};

const rows = async (hubId: string, query: Query): Promise<PageRow[]> =>
  (await listControls(hubId, query)).map((control) => ({
    id: control.id,
    code: control.code,
    text: control.text,
    strength: control.strength,
    action: control.action,
    on_breach: control.onBreach,
    severity: control.severity,
    attached_to: control.attachedTo,
  }));

export const controlsPage: PageModule = {
  spec: {
    id: "controls",
    title: "Controls",
    primary: "Add a control",
    tools: [
      "agency_list_controls",
      "agency_create_control",
      "agency_update_control",
      "agency_delete_control",
      "agency_list_control_attachments",
      "agency_attach_control",
      "agency_detach_control",
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "text", label: "Text" },
      { key: "strength", label: "Strength" },
      { key: "action", label: "Action" },
      { key: "on_breach", label: "On breach" },
      { key: "severity", label: "Severity" },
      { key: "attached_to", label: "Attached to" },
    ],
  },
  rows,
  actions: { controls: createControl, control: updateControl, "control-delete": deleteControl, "control-attach": attachControl, "control-detach": detachControl },
};
