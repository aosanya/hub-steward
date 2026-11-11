import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Rec = Record<string, any>;
export type Table = Record<string, Rec[]> & { agency: Rec };

export type WalkStep = { code: string; role?: string | null; ai: boolean };

export type WalkChecks = {
  roleText?: { role: string; match: string[] }[];
  stepText?: { step: string; match?: string[]; absent?: string[] }[];
  order?: [string, string][];
  objectives?: string[];
  ruleAttached?: { rule: string; target: string }[];
  ruleAttachedToAllObjectives?: boolean;
  itemCount?: number;
  workflowText?: string;
  aiRoleText?: string[];
  nonAiRoleText?: string[];
  aiPromptText?: string;
  firstActor?: string;
};

export type WalkFixture = {
  workflow: string;
  title: string;
  sources?: string[];
  aiClause: string;
  humanApproval: string;
  ruleRef?: string;
  ruleRefOnEveryStep?: boolean;
  nonAiPromptMentionsAi?: boolean;
  steps: WalkStep[];
  checks?: WalkChecks;
};

const here = __dirname;

const readJson = (path: string) => JSON.parse(readFileSync(resolve(here, path), "utf8")) as Table;

export const walkFixtures = () =>
  readdirSync(resolve(here, "walks"))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, fixture: JSON.parse(readFileSync(resolve(here, "walks", name), "utf8")) as WalkFixture }));

export const agencyWith = (sources: string[] = []): Table => {
  const merged: Table = readJson("../../../../demo/municipality.json");
  sources.forEach((source) => {
    const fragment: Table = readJson(`fixtures/${source}.json`);
    (Object.keys(fragment) as string[]).forEach((key) => {
      const ids = new Set(fragment[key].map((entry) => entry.id));
      const codes = new Set(fragment[key].map((entry) => entry.code).filter(Boolean));
      const kept = (merged[key] ?? []).filter((entry) => !ids.has(entry.id) && !(entry.code && codes.has(entry.code)));
      merged[key] = [...kept, ...fragment[key]];
    });
  });
  return merged;
};

export const pattern = (text: string) => (text.startsWith("i:") ? new RegExp(text.slice(2), "i") : new RegExp(text));
