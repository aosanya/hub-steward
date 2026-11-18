import { itemsOf } from "../../features/backlogs";
import { callTool } from "../../shared/wakala/mcp";
import { loadAssetLabels } from "./assetChoices";

export const liveRecordRowsTool = "agency_list_live_record_rows";

const liveRecordsTool = "agency_list_live_records";

const registerNames: Record<string, string> = { "RC-1": "Businesses", "RC-2": "Informal traders", "RC-3": "Maintenance records" };

export type RecordRow = { id: string; title: string; meta: string };

type Raw = Record<string, unknown>;

const absentRecord = /(record|instance) not found/i;

const answerOf = (row: Raw, prompt: string) => {
  const value = (row.answers as Raw | undefined)?.[prompt];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
};

export const recordRowsOf = (rows: Raw[], titlePrompt: string, metaPrompts: string[]): RecordRow[] =>
  rows.map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    title: answerOf(row, titlePrompt),
    meta: metaPrompts.map((prompt) => answerOf(row, prompt)).filter(Boolean).join(" · "),
  }));

export const loadMayAddRows = async (recordCode: string): Promise<boolean> => {
  const name = registerNames[recordCode];
  const records = itemsOf(await callTool("", liveRecordsTool)) as Raw[];
  return records.find((record) => (name ? record.name === name : record.code === recordCode))?.can_add_rows === true;
};

export const resolveRecordCode = async (recordCode: string): Promise<string> => {
  const name = registerNames[recordCode];
  if (!name) return recordCode;
  try {
    const kept = (itemsOf(await callTool("", liveRecordsTool)) as Raw[]).find((record) => record.name === name);
    return typeof kept?.code === "string" ? kept.code : recordCode;
  } catch {
    return recordCode;
  }
};

const loadRawRows = async (recordCode: string, args: Raw = {}): Promise<Raw[]> => {
  try {
    return itemsOf(await callTool("", liveRecordRowsTool, { record_code: await resolveRecordCode(recordCode), ...args })) as Raw[];
  } catch (error) {
    if (error instanceof Error && absentRecord.test(error.message)) return [];
    throw error;
  }
};

const withAssetNames = async (rows: Raw[], assetPrompts: string[]): Promise<Raw[]> => {
  if (assetPrompts.length === 0 || rows.length === 0) return rows;
  const labels = await loadAssetLabels().catch(() => new Map<string, string>());
  return rows.map((row) => ({
    ...row,
    answers: { ...(row.answers as Raw | undefined), ...Object.fromEntries(assetPrompts.map((prompt) => [prompt, labels.get(answerOf(row, prompt))]).filter(([, label]) => label !== undefined)) },
  }));
};

export const loadRecordRows = async (recordCode: string, titlePrompt: string, metaPrompts: string[], assetPrompts: string[] = []): Promise<RecordRow[]> =>
  recordRowsOf(await withAssetNames(await loadRawRows(recordCode), assetPrompts), titlePrompt, metaPrompts);

export const loadRecordRowsHeldBy = async (recordCode: string, titlePrompt: string, metaPrompts: string[], actorId: string): Promise<RecordRow[]> =>
  recordRowsOf(await loadRawRows(recordCode, { answer_actor_id: actorId }), titlePrompt, metaPrompts);

export const recordOwnerKey = "ownerId";
export const recordRowIdKey = "rowId";

export const loadRecordRow = async (recordCode: string, id: string, prompts: string[], ownerPrompt?: string, assetPrompts: string[] = []): Promise<Record<string, string>> => {
  const row = (await withAssetNames(await loadRawRows(recordCode), assetPrompts)).find((one) => one.id === id);
  if (!row) return {};
  const fields = Object.fromEntries(prompts.map((prompt) => [prompt, answerOf(row, prompt)]));
  const owner = ownerPrompt ? answerOf(row, ownerPrompt) : "";
  const named = { ...fields, [recordRowIdKey]: id };
  return owner ? { ...named, [recordOwnerKey]: owner } : named;
};

const chainFrom = (byId: Map<string, Raw>, start: string): string[] => {
  const chain: string[] = [];
  let next = start;
  while (next !== "" && !chain.includes(next)) {
    chain.push(next);
    const replaces = byId.get(next)?.replaces;
    next = typeof replaces === "string" ? replaces : "";
  }
  return chain;
};

const loadCurrentAndOlder = async (recordCode: string) => {
  const [current, older] = await Promise.all([loadRawRows(recordCode), loadRawRows(recordCode, { history: true })]);
  return { current, byId: new Map([...current, ...older].map((row) => [String(row.id), row])) };
};

export const loadRowChain = async (recordCode: string, rowId: string): Promise<string[]> =>
  chainFrom((await loadCurrentAndOlder(recordCode)).byId, rowId);

export const loadRowChains = async (recordCode: string): Promise<Map<string, string[]>> => {
  const { current, byId } = await loadCurrentAndOlder(recordCode);
  return new Map(current.map((row) => [String(row.id), chainFrom(byId, String(row.id))]));
};
