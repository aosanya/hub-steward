import { addLiveRow, loadLiveRecords, loadLiveRows, recordNamed, recordWithKey, textOf, type Raw } from "../../shared/wakala/liveRecords";
import { assetIdKey, goneAssetWords, loadAssetLabels, unreadAssetWords } from "./assetChoices";

const registerNames: Record<string, string> = { "RC-1": "Businesses", "RC-2": "Informal traders", "RC-3": "Maintenance records" };

export type RecordRow = { id: string; title: string; meta: string };

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

const registerOf = async (handle: string): Promise<Raw | undefined> => {
  const records = await loadLiveRecords();
  const name = registerNames[handle];
  return name ? recordNamed(records, name) : recordWithKey(records, handle);
};

export const loadMayAddRows = async (handle: string): Promise<boolean> => (await registerOf(handle))?.can_add_rows === true;

export const resolveRecordKey = async (handle: string): Promise<string> => {
  try {
    return textOf((await registerOf(handle))?.key) || handle;
  } catch {
    return handle;
  }
};

export const saveRegisterRow = async (handle: string, answers: Record<string, string>, more: Raw = {}) => {
  const record = await registerOf(handle);
  if (!record) throw new Error("record not found");
  return addLiveRow(record, answers, more);
};

export const loadRegisterRows = async (handle: string, args: Raw = {}): Promise<Raw[]> => {
  try {
    const record = await registerOf(handle);
    return record ? await loadLiveRows(record, args) : [];
  } catch (error) {
    if (error instanceof Error && absentRecord.test(error.message)) return [];
    throw error;
  }
};

const looksLikeAnId = (answer: string) => /^\S+$/.test(answer);

const assetWordsOf = (answer: string, labels: Map<string, string> | undefined) => {
  if (answer === "") return undefined;
  const label = labels?.get(answer);
  if (label !== undefined) return label;
  if (!looksLikeAnId(answer)) return undefined;
  return labels ? goneAssetWords : unreadAssetWords;
};

const withAssetNames = async (rows: Raw[], assetPrompts: string[]): Promise<Raw[]> => {
  if (assetPrompts.length === 0 || rows.length === 0) return rows;
  const labels = await loadAssetLabels().catch(() => undefined);
  return rows.map((row) => ({
    ...row,
    answers: { ...(row.answers as Raw | undefined), ...Object.fromEntries(assetPrompts.map((prompt) => [prompt, assetWordsOf(answerOf(row, prompt), labels)]).filter(([, words]) => words !== undefined)) },
  }));
};

export const loadRecordRows = async (recordCode: string, titlePrompt: string, metaPrompts: string[], assetPrompts: string[] = []): Promise<RecordRow[]> =>
  recordRowsOf(await withAssetNames(await loadRegisterRows(recordCode), assetPrompts), titlePrompt, metaPrompts);

export const loadRecordRowsHeldBy = async (recordCode: string, titlePrompt: string, metaPrompts: string[], actorId: string): Promise<RecordRow[]> =>
  recordRowsOf(await loadRegisterRows(recordCode, { answer_actor_id: actorId }), titlePrompt, metaPrompts);

export const recordOwnerKey = "ownerId";
export const recordRowIdKey = "rowId";

export const loadRecordRow = async (recordCode: string, id: string, prompts: string[], ownerPrompt?: string, assetPrompts: string[] = []): Promise<Record<string, string>> => {
  const raw = await loadRegisterRows(recordCode);
  const row = (await withAssetNames(raw, assetPrompts)).find((one) => one.id === id);
  if (!row) return {};
  const saved = raw.find((one) => one.id === id) ?? row;
  const fields = Object.fromEntries(prompts.map((prompt) => [prompt, answerOf(row, prompt)]));
  const assetIds = Object.fromEntries(assetPrompts.map((prompt) => [assetIdKey(prompt), answerOf(saved, prompt)]));
  const owner = ownerPrompt ? answerOf(row, ownerPrompt) : "";
  const named = { ...fields, ...assetIds, [recordRowIdKey]: id };
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
  const [current, older] = await Promise.all([loadRegisterRows(recordCode), loadRegisterRows(recordCode, { history: true })]);
  return { current, byId: new Map([...current, ...older].map((row) => [String(row.id), row])) };
};

export const loadRowChain = async (recordCode: string, rowId: string): Promise<string[]> =>
  chainFrom((await loadCurrentAndOlder(recordCode)).byId, rowId);

export const loadRowChains = async (recordCode: string): Promise<Map<string, string[]>> => {
  const { current, byId } = await loadCurrentAndOlder(recordCode);
  return new Map(current.map((row) => [String(row.id), chainFrom(byId, String(row.id))]));
};
