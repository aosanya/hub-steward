import { useState } from "react";
import { useMay } from "../../features/agency/useMay";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import { LoadFailed } from "../../shared/ui/LoadState";
import { callTool, McpError } from "../../shared/wakala/mcp";
import { actionFailedWords } from "./MenuDetail";

export type EditField = { label: string; key: string; required?: boolean; kind?: "text" | "number" | "date" };

type Item = Record<string, unknown>;

type Props = {
  item: Item;
  id: string;
  idArg: string;
  tool: string;
  permission: string;
  fields: EditField[];
  keep?: string[];
  readAgain?: () => Promise<Item>;
  onSaved?: (changed: Record<string, string>) => void;
};

type Clash = { key: string; label: string; theirs: string; mine: string };

const textOf = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export const refusalWords = (error: unknown) => {
  const message = error instanceof McpError ? error.message : "";
  const colon = message.indexOf(": ");
  const words = colon >= 0 ? message.slice(colon + 2) : message;
  return words || actionFailedWords;
};

const inputModes = { text: undefined, number: "decimal", date: undefined } as const;

const startValues = (item: Item, fields: EditField[]) => Object.fromEntries(fields.map((field) => [field.key, textOf(item, field.key)]));

export function MenuEditForm({ item, id, idArg, tool, permission, fields, keep = [], readAgain, onSaved }: Props) {
  const may = useMay(permission);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const [base, setBase] = useState<Record<string, string>>({});
  const [clashes, setClashes] = useState<Clash[]>([]);
  if (!may) return null;
  const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== base[key]));
  const missing = fields.some((field) => field.required && (values[field.key] ?? "").trim() === "");
  const open = () => {
    setValues(start);
    setRefused("");
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", tool, { [idArg]: id, ...Object.fromEntries(keep.map((key) => [key, key in start ? start[key] : textOf(item, key)])), ...changed });
      setEditing(false);
      onSaved?.(changed);
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  if (!editing) return <Button kind="quiet" onClick={open}>Edit</Button>;
  return (
    <>
      {fields.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          type={field.kind === "date" ? "date" : "text"}
          inputMode={inputModes[field.kind ?? "text"]}
          value={values[field.key] ?? ""}
          onChange={(event) => setValues((was) => ({ ...was, [field.key]: event.target.value }))}
        />
      ))}
      {clashes.map((clash) => (
        <div key={clash.key} role="group" aria-label={clash.label}>
          <p>Someone else saved {clash.label} first.</p>
          <p>Hub now: <span>{clash.theirs}</span></p>
          <p>Yours: <span>{clash.mine}</span></p>
          <Button kind="quiet" onClick={() => settle(clash.key, clash.theirs, false)}>Keep mine</Button>
          <Button kind="quiet" onClick={() => settle(clash.key, clash.theirs, true)}>Use theirs</Button>
        </div>
      ))}
      <Button kind="primary" disabled={saving || missing || clashes.length > 0 || Object.keys(changed).length === 0} onClick={save}>Save</Button>
      <Button kind="quiet" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
