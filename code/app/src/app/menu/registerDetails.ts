import { useEffect, useMemo, useState } from "react";
import { callTool } from "../../shared/wakala/mcp";
import { resolveRecordCode } from "./liveRecordRows";
import type { RecordFormField } from "./RecordRowForm";

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
