export type ButtonSpec = { label: string; to?: string; prompt?: string; tool?: string; args?: Record<string, unknown> };

export type CardSpec = { id: string; title: string; lines: string[]; buttons: ButtonSpec[] };

export type FieldSpec = {
  name: string;
  label: string;
  kind: "text" | "number" | "date" | "choice";
  options?: string[];
  required?: boolean;
};

export type Block =
  | { kind: "text"; from: "agent" | "me"; text: string }
  | { kind: "prompts"; prompts: string[] }
  | { kind: "cards"; cards: CardSpec[]; shown: number; more?: string }
  | { kind: "form"; tool: string; title: string; fields: FieldSpec[]; submitLabel: string; fixedArgs?: Record<string, unknown> };

export type ToolRunner = (tool: string, args: Record<string, unknown>) => Promise<unknown>;
