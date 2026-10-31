import { callTool } from "../../wakala/mcp";
import { itemsOf, textOf } from "../../data/pages/groups";
import { listConsequences, listThreats } from "../../data/pages/library";

export type PartKind = "threat" | "consequence";

export type Attached = { id: string; kind: PartKind; title: string };

export type Choice = { value: string; kind: PartKind; id: string; title: string };

export type AttachmentState = { attached: Attached[]; choices: Choice[] };

const kindOf = (value: string): PartKind | null => (value === "threat" || value === "consequence" ? value : null);

export const loadAttachments = async (hubId: string, controlId: string): Promise<AttachmentState> => {
  const [links, threats, consequences] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_control_attachments", { control_id: controlId }),
    listThreats(hubId),
    listConsequences(hubId),
  ]);
  const parts = [
    ...threats.map((part) => ({ kind: "threat" as const, part })),
    ...consequences.map((part) => ({ kind: "consequence" as const, part })),
  ];
  const attached = itemsOf(links).flatMap((link): Attached[] => {
    const kind = kindOf(textOf(link, "target_type"));
    if (!kind) return [];
    const code = textOf(link, "target_code");
    const found = parts.find((one) => one.kind === kind && one.part.code === code);
    return [{ id: textOf(link, "id"), kind, title: found?.part.title || code }];
  });
  const taken = new Set(itemsOf(links).map((link) => textOf(link, "target_type") + ":" + textOf(link, "target_code")));
  const choices = parts
    .filter((one) => !taken.has(one.kind + ":" + one.part.code))
    .map((one) => ({ value: one.kind + ":" + one.part.id, kind: one.kind, id: one.part.id, title: one.part.title }));
  return { attached, choices };
};

export const attachPart = async (hubId: string, controlId: string, choice: Choice) => {
  await callTool(hubId, "agency_attach_control", { control_id: controlId, target_type: choice.kind, target_id: choice.id });
};

export const detachPart = async (hubId: string, attachmentId: string) => {
  await callTool(hubId, "agency_detach_control", { attachment_id: attachmentId });
};

