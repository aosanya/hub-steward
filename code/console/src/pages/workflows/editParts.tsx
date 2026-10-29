import { Labelled, SelectControl, TextControl } from "../../ui";
import type { Choice } from "../../data/pages/workflowDesign";

type TextProps = { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string };

export function TextLabelled({ id, label, value, onChange, disabled, placeholder }: TextProps) {
  return (
    <Labelled id={id} label={label} required={false}>
      <TextControl id={id} label={label} value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} />
    </Labelled>
  );
}

type PickProps = { id: string; label: string; value: string; options: Choice[]; onChange: (value: string) => void; disabled?: boolean };

export function PickLabelled({ id, label, value, options, onChange, disabled }: PickProps) {
  return (
    <Labelled id={id} label={label} required={false}>
      <SelectControl id={id} label={label} value={value} options={options} onChange={onChange} disabled={disabled} />
    </Labelled>
  );
}

export const replaced = <T,>(list: T[], at: number, next: T): T[] => list.map((item, index) => (index === at ? next : item));

export const without = <T,>(list: T[], at: number): T[] => list.filter((_, index) => index !== at);

export const moved = <T,>(list: T[], at: number, by: number): T[] => {
  const to = at + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
};
