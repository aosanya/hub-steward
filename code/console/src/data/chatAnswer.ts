export type ToolRow = { name: string; summary: string; area: string };

export type ToolsAnswer = { kind: "tools"; prompt: string; rows: ToolRow[] };

export type StepFill = { name: string; role: string; kind: string };

export type WorkflowFill = { name: string; description: string; cancel: boolean; steps: StepFill[] };

export type ActorFill = { name: string; role: string };

export type ScenarioFill = { name: string; summary: string; workflow: string; actors: ActorFill[] };

export type ProfileFill = { name: string; purpose: string };

export type SuggestionStep = { tool: string; arguments: Record<string, unknown> };

export type Suggestion = { title: string; detail: string; tool: string; arguments: Record<string, unknown>; then: SuggestionStep[] };

export type SuggestionsFill = { page: string; summary: string; items: Suggestion[] };

export type FormFill = { form: "workflow"; fill: WorkflowFill } | { form: "scenario"; fill: ScenarioFill } | { form: "profile"; fill: ProfileFill };

export type FormAnswer = { kind: "form"; prompt: string } & FormFill;

export type SuggestionsAnswer = { kind: "suggestions"; prompt: string; fill: SuggestionsFill };

export type ActionAnswer = { kind: "action"; prompt: string; view: string; title: string; params: Record<string, unknown> };

export type SlotAnswer = ToolsAnswer | ActionAnswer;

export type ChatAnswer = ToolsAnswer | FormAnswer | SuggestionsAnswer | ActionAnswer;

export type CallLog = { name: string; summary: string; state: "done" | "error"; ms: number };

export type Reply = { text: string; calls: CallLog[]; answer?: ChatAnswer; newTopic?: boolean; changed?: string };
