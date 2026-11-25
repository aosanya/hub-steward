import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import type { BacklogsClient } from "../shared/api";
import type { Answer, OpenedRule, Rule, RuleFile, RuleIssue, RulebookClient } from "./types";

export const ready = <T,>(data: T): Answer<T> => ({ state: "ready", data });

export const rule = (over: Partial<Rule> = {}): Rule => ({
  id: "id-R-1",
  kind: "rule",
  code: "R-1",
  title: "No comments in code",
  body: "",
  status: "in_force",
  tags: ["code"],
  supersedes: "",
  supersededBy: "",
  decidedBy: "",
  decidedAt: "",
  priority: "",
  answeredBy: "",
  createdAt: "",
  ...over,
});

export const issue = (code: string, title: string, relation = "applies_to"): RuleIssue => ({ id: `id-${code}`, code, title, relation });

export const file = (over: Partial<RuleFile> = {}): RuleFile => ({ id: "f1", repo: "hub-steward", path: "code/app/src/tokens.css", line: 0, note: "", addedBy: "", missing: false, ...over });

export const opened = (record: Rule, over: Partial<OpenedRule> = {}): OpenedRule => ({ rule: record, issues: [], files: [], produced: [], settledIn: [], ...over });

const unused = async () => {
  throw new Error("unused");
};

export const clientOf = (over: Partial<RulebookClient> = {}): RulebookClient => ({
  list: vi.fn(async () => ready([])),
  read: unused,
  issues: unused,
  files: unused,
  produced: unused,
  settledIn: unused,
  why: unused,
  open: vi.fn(async () => ready(opened(rule()))),
  ...over,
});

export const backlogsClient: BacklogsClient = {
  backlogs: async () => [{ id: "b1", name: "Sprint 1", steps: ["To do", "Done"], issues: 0 }],
  issues: async () => [],
  issue: async () => ({}) as never,
};

export const arrive = () => openAgency("hub-1");

export const leave = () => {
  cleanup();
  forgetOpenAgency();
};

export const Where = () => {
  const place = useLocation();
  return (
    <>
      <p data-testid="where">{place.pathname + place.search}</p>
      <p data-testid="state">{JSON.stringify(place.state)}</p>
    </>
  );
};

export const at = (path: string, route: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
