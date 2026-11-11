import { render } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { openAgency } from "../../agency/open";
import { IssuePage } from "../IssuePage";
import type { BacklogsClient, IssueDetail, NotesClient } from "../api";
import { AddReferencePage } from "./AddReferencePage";
import type { Reference, ReferencesClient, RepoClient, RepoEntry } from "./api";

export const reference = (over: Partial<Reference>): Reference => ({ id: "r1", kind: "file", repo: "hub-steward", target: "app/main.tsx", source: "person", confirmed: true, ...over });

const detail: IssueDetail = {
  id: "1",
  code: "HS-002",
  title: "Import the municipality",
  description: "Load the template.",
  status: "pending",
  step: "To do",
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "",
  rank: 1,
  waitsOn: [],
  waitedOnBy: [],
};

const backlogs: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue: async () => detail };

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

export const fakeReferences = (held: Reference[] = [], over: Partial<ReferencesClient> = {}) => {
  const client = {
    list: vi.fn(async () => [...held]),
    add: vi.fn(async (_issue: string, kind: Reference["kind"], repo: string, target: string) => {
      const added = reference({ id: `n${held.length + 1}`, kind, repo, target });
      held.push(added);
      return added;
    }),
    remove: vi.fn(async (_issue: string, id: string) => {
      held.splice(0, held.length, ...held.filter((one) => one.id !== id));
    }),
    confirm: vi.fn(async (_issue: string, id: string) => {
      held.forEach((one) => one.id === id && (one.confirmed = true));
    }),
    findIssue: vi.fn(async (): Promise<string | null> => null),
    ...over,
  };
  return client satisfies ReferencesClient;
};

export const trees: Record<string, Record<string, RepoEntry[]>> = {
  "hub-steward-swe": {
    "": [
      { name: "loader", path: "loader", folder: true },
      { name: "README.md", path: "README.md", folder: false },
    ],
    loader: [
      { name: "importer.go", path: "loader/importer.go", folder: false },
      { name: "report.go", path: "loader/report.go", folder: false },
    ],
    documentation: [{ name: "intro.md", path: "documentation/intro.md", folder: false }],
  },
};

export const fakeRepos = (over: Partial<RepoClient> = {}) => ({
  repos: vi.fn(async (): Promise<string[]> => []),
  entries: vi.fn(async (repo: string, path: string): Promise<RepoEntry[] | null> => trees[repo]?.[path] ?? null),
  ...over,
}) satisfies RepoClient;

function Here() {
  const { pathname } = useLocation();
  return <output data-testid="here">{pathname}</output>;
}

export const openIssue = (references: ReferencesClient, repos: RepoClient = fakeRepos(), at = "/a/hub-1/backlogs/issue/1") => {
  openAgency("hub-1");
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={backlogs} notesClient={notes} referencesClient={references} repoClient={repos} />} />
        <Route path="/a/:agencyId/backlogs/issue/:issueId/references/add" element={<AddReferencePage client={references} repoClient={repos} />} />
      </Routes>
      <Here />
    </MemoryRouter>,
  );
};
