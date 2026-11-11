import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { FieldSpec, OptionItem } from "../types";

export type ButtonKind = "primary" | "quiet" | "danger";
export type ButtonSize = "sm" | "xs";
export type ButtonLook = { kind?: ButtonKind; size?: ButtonSize; icon?: string; wide?: boolean };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook;

export type ButtonLinkProps = ButtonLook & { to: string; className?: string; title?: string; onClick?: () => void; children: ReactNode };

export type LinkProps = { to?: string; onClick?: () => void; arrow?: boolean; size?: "sm"; className?: string; children: ReactNode };

export type TitleRowProps = {
  title: string;
  primary?: string;
  onPrimary?: () => void;
  primaryTo?: string;
  primaryIcon?: string;
  primaryFlash?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
};

export type NoticeKind = "ok" | "bad";
export type NoticeProps = { text: string; kind?: NoticeKind; onDismiss: () => void };

export type StatItem = { label: string; value: ReactNode; sub?: string };
export type StatsProps = { items: StatItem[] };

export type TableRowData = { key: string; cells: ReactNode[]; actions?: ReactNode };
export type DataTableProps = { columns: string[]; rows: TableRowData[]; empty: string; emptyAction?: ReactNode; className?: string };

export type DetailProps = { pairs: [string, ReactNode][]; title?: ReactNode; actions?: ReactNode };

export type SettingRowData = { label: string; control: ReactNode; htmlFor?: string };
export type SettingRowsProps = { rows: SettingRowData[]; title?: string };

export type CardProps = { title?: ReactNode; actions?: ReactNode; footer?: ReactNode; level?: 2 | 3 | "plain"; tight?: boolean; className?: string; open?: boolean; onToggle?: () => void; children?: ReactNode };

export type MsgButtonData = { label: string; kind?: ButtonKind; to?: string; onClick?: () => void; disabled?: boolean };
export type ActionState = "pending" | "done";

export type ActionCardProps = {
  title: string;
  text?: string;
  state?: ActionState;
  buttons?: MsgButtonData[];
  onApprove?: () => void;
  onDecline?: () => void;
};

export type TabItem = { to: string; label: string; current: boolean };
export type TabsProps = { items: TabItem[] };

export type ChipKind = "use" | "ok" | "warn" | "bad" | "mute";
export type ChipProps = { kind?: ChipKind; children: ReactNode };
export type ChipsProps = { items: string[] };

export type SearchFieldProps = { placeholder: string; value?: string; onChange?: (value: string) => void };

export type SelectFieldProps = {
  icon: string;
  label: string;
  value?: string;
  options: (string | OptionItem)[];
  onChange?: (value: string) => void;
  className?: string;
};

export type FilterChipProps = { text: string; onRemove?: () => void };

export type FilterBarProps = {
  placeholder: string;
  chips: string[];
  search?: string;
  onSearch?: (value: string) => void;
  selects?: (Omit<SelectFieldProps, "className"> & { key?: string })[];
  onRemoveChip?: (chip: string) => void;
  right?: ReactNode;
};

export type ToolbarProps = { left?: ReactNode; right?: ReactNode };

export type EmptyProps = { text: string; failed?: boolean; action?: ReactNode };

export type StatusLineProps = { text: string; failed?: boolean };

export type TileState = "ok" | "warn" | "bad" | "mute";
export type TileProps = { label: string; value: ReactNode; state?: TileState; to?: string };

export type ProgressProps = { pct: number; label?: string };

export type CellProps = { text: string; lead?: ReactNode; sub?: ReactNode; strong?: boolean; to?: string; title?: string };

export type MarkProps = { children: ReactNode; accent?: boolean };
export type AvatarProps = { name: string };
export type GlyphProps = { name: string };

export type TimelineState = "done" | "now" | "next";
export type TimelineItem = { title: string; meta: ReactNode; state: TimelineState };
export type TimelineProps = { items: TimelineItem[] };

export type ToggleProps = {
  label: string;
  on: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  name?: string;
  labelledBy?: string;
  id?: string;
};

export type AddTileProps = { text: string; to?: string; onClick?: () => void; note?: string };

export type ThemeChoice = { key: string; label: string; colours: [string, string, string] };
export type ThemePickerProps = { value: string; onChange?: (theme: string) => void; themes?: ThemeChoice[] };

export type ControlProps = { id?: string; value: string; onChange?: (value: string) => void; placeholder?: string; disabled?: boolean; label?: string };
export type TextareaControlProps = ControlProps & { rows?: number };
export type SelectControlProps = Omit<ControlProps, "placeholder"> & { options: (string | OptionItem)[] };

export type SectionTitleProps = { title: string; right?: ReactNode };
export type StackProps = { gap?: number; children: ReactNode };
export type RowProps = { gap?: number; children: ReactNode };
export type GridProps = { min?: number; gap?: number; children: ReactNode };
export type TwoColProps = { ratio?: string; left: ReactNode; right: ReactNode };
export type NoteProps = { children: ReactNode };

export type FromChatProps = { prompt: string; title?: string; onClear?: () => void; children: ReactNode };

export type CardRow = { label?: string; value: ReactNode };
export type ListCardItem = { name: string; meta?: string; chip?: ReactNode; to?: string };
export type ListCardProps = { title: string; items: ListCardItem[]; nav?: MsgButtonData };
export type RowsCardRow = { kind?: "new" | "changed"; cells: ReactNode[] };
export type RowsCardProps = { title: string; rows: RowsCardRow[]; columns?: string[] };
export type ResultCardItem = string | { label: string; value: ReactNode };
export type ResultCardProps = { title: string; rows: ResultCardItem[] };
export type EditCardRow = { label: string; value: string };
export type EditCardProps = { title: string; rows: EditCardRow[]; onSave?: (values: string[]) => void; onCancel?: () => void };

export type FormCardField = {
  name?: string;
  kind?: "text" | "select" | "textarea" | "toggle";
  label: string;
  value?: string | boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
};
export type FormCardValues = Record<string, string | boolean>;
export type FormCardProps = {
  title?: string;
  fields: FormCardField[];
  submit?: string;
  cancel?: string;
  hint?: string;
  onSubmit?: (values: FormCardValues) => void;
  onCancel?: () => void;
};

export type FormValues = Record<string, unknown>;

export type FieldProps = {
  spec: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  unit?: string;
  placeholder?: string;
  set?: boolean;
  layout?: "stack" | "rows";
};

export type FormObjectProps = {
  title: string;
  fields: FieldSpec[];
  pending?: boolean;
  tool?: string;
  initial?: FormValues;
  errors?: Record<string, string>;
  submitLabel?: string;
  onSubmit: (values: FormValues) => Promise<string | void>;
  onCancel: () => void;
};

export type SchemaFormProps = Omit<FormObjectProps, "fields"> & { schema: object; choices?: Record<string, (string | OptionItem)[]> };

export type ToolState = "done" | "running" | "error";
export type ToolCall = { name: string; summary: string; state?: ToolState; ms?: number };

export type MsgToolsProps = { calls: ToolCall[]; title?: string; expanded?: boolean };
export type MsgUserProps = { children: ReactNode };
export type MsgChoiceProps = { question: string; options: string[]; picked?: string; onPick?: (option: string) => void };
export type MsgConfirmProps = {
  title: string;
  detail: ReactNode;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
  resolved?: "confirmed" | "cancelled";
  onConfirm?: () => void;
  onCancel?: () => void;
};
export type MsgErrorProps = { children: ReactNode };
export type MsgSuggestionProps = { text: ReactNode; actions: MsgButtonData[] };
export type MsgActionProps = { title: string; detail?: ReactNode; buttons?: MsgButtonData[]; state?: ActionState };
export type MsgRefProps = { title: string; count: number; nav?: MsgButtonData };
export type MsgFormProps = { title: string };
export type MsgNavProps = { label: string; to: string; icon: string };
