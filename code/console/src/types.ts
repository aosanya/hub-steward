export type Hub = {
  id: string;
  name: string;
  role: string;
  model_key_set?: boolean;
  manager_room_id?: string;
  kind?: string;
};

export type PageColumn = { key: string; label: string };

export type PageSpec = {
  id: string;
  title: string;
  primary: string;
  tools: string[];
  columns: PageColumn[];
};

export type PageRow = Record<string, unknown> & { id?: string; edit?: string };

export type OptionItem = { value: string; label: string };

export type FieldComponent =
  | "text"
  | "secret"
  | "textarea"
  | "number"
  | "select"
  | "radios"
  | "toggle"
  | "date"
  | "chips"
  | "file"
  | "readonly";

export type FieldSpec = {
  name: string;
  component: FieldComponent;
  required?: boolean;
  options?: (string | OptionItem)[];
  readOnly?: boolean;
  optionsFrom?: string;
};
