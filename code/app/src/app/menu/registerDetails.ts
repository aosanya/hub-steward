import { useEffect, useMemo, useState } from "react";
import { callTool } from "../../shared/wakala/mcp";
import { resolveRecordCode } from "./liveRecordRows";
import type { RecordFormField } from "./RecordRowForm";

export const residentRecordCode = "RESIDENT";
export const residentTitlePrompt = "Name";
export const residentFields: RecordFormField[] = [
  { prompt: "Name", required: true },
  { prompt: "Phone", required: false },
  { prompt: "Email", required: false },
];

export const holdingRecordCode = "HOLDING";
export const holdingTitlePrompt = "Property";
export const holdingFields: RecordFormField[] = [
  { prompt: "Property", required: true, fixed: true },
  { prompt: "Kind", required: false },
  { prompt: "Since", required: false },
];

export type RegisterDetail = { prompt: string; on: boolean; required: boolean; own: boolean };

const settingKeyOf = async (recordCode: string) => `register_details:${await resolveRecordCode(recordCode)}`;

const isDetail = (value: unknown): value is RegisterDetail => {
  const detail = value as Partial<RegisterDetail> | null;
  return typeof detail?.prompt === "string" && typeof detail.on === "boolean" && typeof detail.required === "boolean" && typeof detail.own === "boolean";
};

export const readRegisterDetails = async (recordCode: string): Promise<RegisterDetail[]> => {
  try {
    const reply = (await callTool("", "forms_catalog_setting_read", { key: await settingKeyOf(recordCode) })) as { value?: unknown } | null;
    const chosen = JSON.parse(typeof reply?.value === "string" ? reply.value : "{}");
    return Array.isArray(chosen.details) ? chosen.details.filter(isDetail) : [];
  } catch {
    return [];
  }
};

export const writeRegisterDetails = async (recordCode: string, details: RegisterDetail[]) =>
  callTool("", "forms_catalog_setting_write", { key: await settingKeyOf(recordCode), value: JSON.stringify({ details }) });

export const detailsOf = (defaults: RecordFormField[], chosen: RegisterDetail[]): RegisterDetail[] => [
  ...defaults.map((field) => {
    if (field.fixed) return { prompt: field.prompt, on: true, required: field.required, own: false };
    const kept = chosen.find((detail) => !detail.own && detail.prompt === field.prompt);
    return { prompt: field.prompt, on: kept?.on ?? true, required: kept ? kept.on && kept.required : field.required, own: false };
  }),
  ...chosen.filter((detail) => detail.own),
];

export const fieldsOf = (defaults: RecordFormField[], chosen: RegisterDetail[]): RecordFormField[] =>
  detailsOf(defaults, chosen)
    .filter((detail) => detail.on)
    .map((detail) => {
      const base = detail.own ? undefined : defaults.find((field) => field.prompt === detail.prompt);
      return base ? { ...base, required: detail.required } : { prompt: detail.prompt, required: detail.required };
    });

export function useRegisterFields(recordCode: string, defaults: RecordFormField[]): RecordFormField[] {
  const [chosen, setChosen] = useState<RegisterDetail[]>([]);
  useEffect(() => {
    let live = true;
    readRegisterDetails(recordCode).then((details) => live && setChosen(details));
    return () => {
      live = false;
    };
  }, [recordCode]);
  return useMemo(() => fieldsOf(defaults, chosen), [defaults, chosen]);
}

export type RegisterAnswers = Record<string, string>;

const answersKeyOf = (recordCode: string, id: string) => `register_answers:${recordCode}:${id}`;

export const readRegisterAnswers = async (recordCode: string, id: string): Promise<RegisterAnswers> => {
  try {
    const reply = (await callTool("", "forms_catalog_setting_read", { key: answersKeyOf(recordCode, id) })) as { value?: unknown } | null;
    const kept = JSON.parse(typeof reply?.value === "string" ? reply.value : "{}").answers;
    return Object.fromEntries(Object.entries(kept ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
};

export const writeRegisterAnswers = (recordCode: string, id: string, answers: RegisterAnswers) =>
  callTool("", "forms_catalog_setting_write", { key: answersKeyOf(recordCode, id), value: JSON.stringify({ answers }) });

export function useRegisterDetails(recordCode: string, defaults: RecordFormField[]): RegisterDetail[] {
  const [chosen, setChosen] = useState<RegisterDetail[]>([]);
  useEffect(() => {
    let live = true;
    readRegisterDetails(recordCode).then((details) => live && setChosen(details));
    return () => {
      live = false;
    };
  }, [recordCode]);
  return useMemo(() => detailsOf(defaults, chosen), [defaults, chosen]);
}
