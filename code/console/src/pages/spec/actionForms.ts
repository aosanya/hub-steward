import type { ToolDrawing } from "../../data/actionSchema";
import type { FieldSpec, OptionItem } from "../../types";

export type ActionFormId =
  | "users"
  | "goals"
  | "objectives"
  | "roles"
  | "profile"
  | "hubname"
  | "general"
  | "language"
  | "documents";

export type ActionForm = {
  title?: string;
  page: string;
  action: string;
  drawing?: ToolDrawing;
  pickers?: Record<string, string>;
  choices?: Record<string, (string | OptionItem)[]>;
  fields?: FieldSpec[];
};

export type SecondaryForm = { form: ActionFormId; label: string };

const joinModes = ["open", "confirmed"];

const text = (name: string, required = false): FieldSpec => ({ name, component: "text", required });
const textarea = (name: string, required = false): FieldSpec => ({ name, component: "textarea", required });
const picker = (name: string, optionsFrom: string): FieldSpec => ({ name, component: "select", optionsFrom, required: true });

const roomy = { format: "textarea" };

export const actionForms: Record<ActionFormId, ActionForm> = {
  users: {
    page: "users",
    action: "users",
    drawing: { tool: "actor_invite_to_group", show: ["group_id", "actor_code", "actor_id", "name"], shape: { name: { type: "string" } } },
    pickers: { group_id: "groups" },
  },
  goals: {
    page: "goals",
    action: "goals",
    drawing: { tool: "agency_create_goal", show: ["title", "description"], shape: { description: roomy } },
  },
  objectives: {
    title: "addObjective",
    page: "goals",
    action: "objectives",
    drawing: { tool: "agency_create_objective", show: ["goal_id", "title", "description"], shape: { description: roomy } },
    pickers: { goal_id: "goals" },
  },
  roles: {
    page: "roles",
    action: "roles",
    drawing: { tool: "agency_create_role", show: ["name", "description"], shape: { description: roomy } },
  },
  profile: {
    page: "profile",
    action: "profile",
    drawing: { tool: "agency_update_agency", show: ["name", "description"], shape: { description: roomy } },
  },
  hubname: {
    title: "renameHub",
    page: "profile",
    action: "hubname",
    drawing: { tool: "instance_rename", show: ["name"] },
  },
  general: {
    page: "general",
    action: "general",
    drawing: { tool: "instance_set_join_mode", show: ["join_mode"] },
    choices: { join_mode: joinModes },
  },
  language: {
    title: "setDefaultLanguage",
    page: "general",
    action: "language",
    fields: [picker("language", "general")],
  },
  documents: {
    page: "documents",
    action: "documents",
    fields: [text("title", true), text("language"), textarea("text", true)],
  },
};

const secondaryForms: Record<string, SecondaryForm[]> = {
  general: [{ form: "language", label: "setDefaultLanguage" }],
  profile: [{ form: "hubname", label: "renameHub" }],
  goals: [{ form: "objectives", label: "addObjective" }],
};

export const isActionFormId = (id: string): id is ActionFormId => Object.hasOwn(actionForms, id);

export const secondaryFormsOf = (page: string): SecondaryForm[] =>
  Object.hasOwn(secondaryForms, page) ? secondaryForms[page] : [];
