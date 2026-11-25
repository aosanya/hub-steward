import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import type { Answer, Rule, RuleFile, RuleIssue } from "../rulebook";
import type { BookClient, Refs } from "./bookClient";

export const dated = (over: Partial<Rule> = {}): Rule => ({
  id: "id-R-1",
  kind: "rule",
  code: "R-1",
  title: "No comments in code",
  body: "",
  status: "in_force",
  tags: [],
  supersedes: "",
  supersededBy: "",
  decidedBy: "",
  decidedAt: "",
  priority: "",
  answeredBy: "",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

export const numbered = (n: number, over: Partial<Rule> = {}): Rule => dated({ id: `id-R-${n}`, code: `R-${n}`, title: `Rule ${n}`, ...over });

export const issueOf = (code: string, relation = "decided_in"): RuleIssue => ({ id: `id-${code}`, code, title: `Issue ${code}`, relation });

export const fileOf = (over: Partial<RuleFile> = {}): RuleFile => ({ id: "f1", repo: "hub-steward", path: "code/app/src/tokens.css", line: 0, note: "", addedBy: "", missing: false, ...over });


export const readyRules = (data: Rule[]): Answer<Rule[]> => ({ state: "ready", data });

export const bookClientOf = (rules: Answer<Rule[]>, refs: Record<string, Refs> = {}): BookClient => ({
  rules: vi.fn(async () => rules),
  refs: vi.fn(async (code: string) => refs[code] ?? { cameFrom: [], files: [] }),
});

export const arrive = () => {
  openAgency("hub-1");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 25, 10, 0));
};

export const leave = () => {
  cleanup();
  vi.useRealTimers();
  forgetOpenAgency();
};

const Where = () => {
  const place = useLocation();
  return (
    <>
      <p data-testid="where">{place.pathname + place.search}</p>
      <p data-testid="state">{JSON.stringify(place.state)}</p>
    </>
  );
};

export const bookAt = (element: JSX.Element, path = "/a/hub-1/backlogs/book", state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/book" element={element} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
