import { useEffect, useRef, useState } from "react";
import { useMay } from "../../features/agency/useMay";
import { Button } from "../../shared/ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../shared/ui/ChoiceRow";
import { Field } from "../../shared/ui/Field";
import { LoadFailed } from "../../shared/ui/LoadState";
import type { Choice } from "../../shared/ui/SearchSelect";
import { TextArea } from "../../shared/ui/TextArea";
import { callTool, McpError } from "../../shared/wakala/mcp";
import { actionFailedWords } from "./MenuDetail";

export type EditField = { label: string; key: string; required?: boolean; kind?: "text" | "number" | "date" | "lines"; choices?: (string | Choice)[] };

type Item = Record<string, unknown>;

type Props = {
  item: Item;
  id: string;
  idArg: string;
  tool: string;
  permission: string;
  fields: EditField[];
  keep?: string[];
  editLabel?: string;
  readAgain?: () => Promise<Item>;
  build?: (sent: Record<string, unknown>) => Record<string, unknown>;
  alsoSave?: (changed: Record<string, string>) => Promise<unknown>;
  onSaved?: (changed: Record<string, string>) => void;
  bare?: boolean;
  openCount?: number;
  onCancel?: () => void;
  visible?: (key: string, values: Record<string, string>) => boolean;
  check?: (values: Record<string, string>) => string;
  retryLabel?: string;
};

type Clash = { key: string; label: string; theirs: string; mine: string };

const dayOf = (text: string) => text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? text;

const instantOf = (day: string) => (/^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T00:00:00Z` : day);

const textOf = (item: Item, key: string, field?: EditField) => {
  const value = item[key];
  if (field?.kind === "date" && typeof value === "string") return dayOf(value);
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value.join("\n");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const choiceOf = (choice: string | Choice): Choice => (typeof choice === "string" ? { value: choice, label: choice } : choice);

const linesOf = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const sameText = (field: EditField | undefined, one: string, other: string) =>
  field?.kind === "lines" ? linesOf(one).join("\n") === linesOf(other).join("\n") : one === other;

export const refusalWords = (error: unknown) => {
  const message = error instanceof McpError ? error.message : "";
  const colon = message.indexOf(": ");
  const words = colon >= 0 ? message.slice(colon + 2) : message;
  return words || actionFailedWords;
};

const wholeOrDecimal = /^-?\d+(\.\d+)?$/;

const isNumber = (text: string) => wholeOrDecimal.test(text.trim());

const sendable = (field: EditField | undefined, text: string) => {
  if (field?.kind === "lines") return linesOf(text);
  if (field?.kind === "date") return instantOf(text.trim());
  return field?.kind === "number" && isNumber(text) ? Number(text.trim()) : text;
};

const versionOf = (item: Item) => (typeof item.updated_at === "string" && item.updated_at !== "" ? item.updated_at : undefined);

const staleNote = " changed since you read it";

const namedStale = (error: unknown, fields: EditField[]) => {
  const message = error instanceof McpError ? error.message.toLowerCase() : "";
  return fields.find((field) => [field.key, field.label].some((name) => message.includes(name.toLowerCase() + staleNote)));
};

const inputModes = { text: undefined, number: "decimal", date: undefined, lines: undefined } as const;

const startValues = (item: Item, fields: EditField[]) => Object.fromEntries(fields.map((field) => [field.key, textOf(item, field.key, field)]));

export function MenuEditForm({ item, id, idArg, tool, permission, fields, keep = [], editLabel = "Edit", readAgain, build, alsoSave, onSaved, bare = false, openCount = 0, onCancel, visible, check, retryLabel = "Save" }: Props) {
  const may = useMay(permission);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const [base, setBase] = useState<Record<string, string>>({});
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [version, setVersion] = useState<string | undefined>(undefined);
  const [written, setWritten] = useState(false);
  const opener = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (openCount > 0) opener.current();
  }, [openCount, may]);
  if (!may) return null;
  const fieldOf = (key: string) => fields.find((field) => field.key === key);
  const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => !sameText(fieldOf(key), value, base[key])));
  const shown = fields.filter((field) => !visible || visible(field.key, values));
  const missing = shown.some((field) => field.required && (values[field.key] ?? "").trim() === "");
  const notNumber = (field: EditField) => field.kind === "number" && field.key in changed && !isNumber(values[field.key] ?? "");
  const invalid = shown.some(notNumber);
  const kept = (key: string) => {
    const field = fieldOf(key);
    if (!field) {
      const value = item[key];
      return typeof value === "string" || typeof value === "number" ? value : "";
    }
    const recorded = item[key];
    const text = key in base ? base[key] : textOf(item, key, field);
    if (field.kind === "date" && typeof recorded === "string" && dayOf(recorded) === text) return recorded;
    return sendable(field, text);
  };
  const sent = (key: string, text: string) => sendable(fieldOf(key), text);
  const open = () => {
    const start = startValues(item, fields);
    setBase(start);
    setValues(start);
    setRefused("");
    setClashes([]);
    setVersion(versionOf(item));
    setWritten(false);
    setEditing(true);
  };
  opener.current = open;
  const settle = (key: string, theirs: string, useTheirs: boolean) => {
    setBase((was) => ({ ...was, [key]: theirs }));
    if (useTheirs) setValues((was) => ({ ...was, [key]: theirs }));
    setClashes((was) => was.filter((clash) => clash.key !== key));
  };
  const clashesAgainst = (present: Record<string, string>, candidates: EditField[]) =>
    candidates
      .filter((field) => present[field.key] !== base[field.key])
      .map((field) => ({ key: field.key, label: field.label, theirs: present[field.key], mine: values[field.key] ?? "" }));
  const settleStale = async (field: EditField) => {
    if (!readAgain) return false;
    const reread = await readAgain();
    const found = clashesAgainst(startValues(reread, fields), [field]);
    if (found.length === 0) return false;
    setVersion(versionOf(reread));
    setClashes(found);
    return true;
  };
  const save = async () => {
    const problem = written ? "" : (check?.(values) ?? "");
    if (problem) {
      setRefused(problem);
      return;
    }
    setSaving(true);
    setRefused("");
    try {
      if (readAgain && !written) {
        const reread = await readAgain();
        const found = clashesAgainst(startValues(reread, fields), fields.filter((field) => field.key in changed));
        if (found.length > 0) {
          setVersion(versionOf(reread));
          setClashes(found);
          return;
        }
      }
      const sentChanges = Object.fromEntries(Object.entries(changed).map(([key, text]) => [key, sent(key, text)]));
      if (!written) {
        await callTool("", tool, build ? build(sentChanges) : { [idArg]: id, ...(version ? { version } : {}), ...Object.fromEntries(keep.map((key) => [key, kept(key)])), ...sentChanges });
        setWritten(true);
      }
      await alsoSave?.(changed);
      setEditing(false);
      onSaved?.(changed);
    } catch (error) {
      const stale = namedStale(error, fields);
      const shown = stale ? await settleStale(stale).catch(() => false) : false;
      if (!shown) setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  if (!editing) return bare ? null : <Button kind="quiet" onClick={open}>{editLabel}</Button>;
  return (
    <>
      {shown.map((field) =>
        field.choices ? (
          <ChoiceGroup key={field.key} label={field.label}>
            {field.choices.map(choiceOf).map(({ value, label }) => (
              <ChoiceRow key={value} type="radio" name={field.key} label={label} checked={values[field.key] === value} onChange={() => setValues((was) => ({ ...was, [field.key]: value }))} />
            ))}
          </ChoiceGroup>
        ) : field.kind === "lines" ? (
          <TextArea key={field.key} label={field.label} rows={6} value={values[field.key] ?? ""} onChange={(event) => setValues((was) => ({ ...was, [field.key]: event.target.value }))} />
        ) : (
          <Field
            key={field.key}
            label={field.label}
            type={field.kind === "date" ? "date" : "text"}
            inputMode={inputModes[field.kind ?? "text"]}
            error={notNumber(field) ? `${field.label} must be a number` : undefined}
            value={values[field.key] ?? ""}
            onChange={(event) => setValues((was) => ({ ...was, [field.key]: event.target.value }))}
          />
        ),
      )}
      {clashes.map((clash) => (
        <div key={clash.key} role="group" aria-label={clash.label}>
          <p>Someone else saved {clash.label} first.</p>
          <p>Hub now: <span>{clash.theirs}</span></p>
          <p>Yours: <span>{clash.mine}</span></p>
          <Button kind="quiet" onClick={() => settle(clash.key, clash.theirs, false)}>Keep mine</Button>
          <Button kind="quiet" onClick={() => settle(clash.key, clash.theirs, true)}>Use theirs</Button>
        </div>
      ))}
      <Button kind="primary" disabled={saving || missing || invalid || clashes.length > 0 || Object.keys(changed).length === 0} onClick={save}>{written ? retryLabel : "Save"}</Button>
      <Button kind="quiet" disabled={saving} onClick={() => { setEditing(false); onCancel?.(); }}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
