import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import * as mcp from "../../shared/wakala/mcp";
import { recordServed, rowServed } from "../../shared/wakala/liveRecords.test-support";
import type { Backlog } from "../../features/backlogs";
import type { StartStep } from "../../features/market";
import type { MemberStep } from "../../features/steps/api";
import { AgencyHome } from "./AgencyHome";
import { HomeSectionPage } from "./HomeSectionPage";
import { HomeRecordRows } from "./HomeRecordRows";
import { HomeRowPage } from "./HomeRowPage";
import { HomeWaiting } from "./HomeWaiting";

export const homeTool = "agency_get_home";

export const rolesTool = "agency_get_my_roles";

export const liveRecordsTool = "agency_list_live_records";

export const liveRowsTool = "agency_list_live_record_rows";

export const sectionPathOf = (agency: string, key: string) => `/a/${agency}/home/${key}`;

export const recordPathOf = (agency: string, entryKey: string, code: string, outerRowId = "") => `/a/${agency}/home/${entryKey}/records/${code}${outerRowId ? `?row=${outerRowId}` : ""}`;

export const rowPagePathOf = (agency: string, key: string, rowId: string) => `/a/${agency}/home/${key}/row/${rowId}`;

export const waitingPathOf = (agency: string, entryKey: string, scopeRowId = "") => `/a/${agency}/home/${entryKey}/waiting${scopeRowId ? `?row=${scopeRowId}` : ""}`;

export const homePathOf = (agency: string) => `/a/${agency}/home`;

export const sectionRoute = "/a/:agencyId/home/:key";

export const recordRoute = "/a/:agencyId/home/:entryKey/records/:code";

export const rowPageRoute = "/a/:agencyId/home/:key/row/:rowId";

export const waitingRoute = "/a/:agencyId/home/:entryKey/waiting";

export const homeRoute = "/a/:agencyId/home";

export const AgencyHomeScreen = AgencyHome;

export const SectionScreen = HomeSectionPage;

export const RecordRowsScreenOfHome = HomeRecordRows;

export const RowPageScreen = HomeRowPage;

export const WaitingScreen = HomeWaiting;

export type Condition = { question: string; operator: string; value: string | { row: string } };

export type Target = { type: "record" | "workflow" | "backlog" | "menu" | "files" | "start" | "ongoing"; ref?: string; target_name?: string; workflow_id?: string; step?: string; scope?: string; where?: Condition[] };

export type HomeNode = {
  key: string;
  title: string;
  titles?: Record<string, string>;
  icon?: string;
  permission?: string;
  roles?: string[];
  page_of?: string;
  entries?: HomeNode[];
  target?: Target;
};

type WireNode = {
  key: string;
  title: string;
  titles?: Record<string, string>;
  icon?: string;
  permission?: string;
  roles?: string[];
  page_of?: string;
  target?: { type: string; ref?: string; step?: string; scope?: string; where?: Condition[] };
  target_name?: string;
  workflow_id?: string;
  entries?: WireNode[];
};

const wireOf = (node: HomeNode): WireNode => ({
  key: node.key,
  title: node.title,
  ...(node.titles ? { titles: node.titles } : {}),
  ...(node.icon ? { icon: node.icon } : {}),
  ...(node.permission ? { permission: node.permission } : {}),
  ...(node.roles ? { roles: node.roles } : {}),
  ...(node.page_of ? { page_of: node.page_of } : {}),
  ...(node.target
    ? {
        target: {
          type: node.target.type,
          ...(node.target.ref ? { ref: node.target.ref } : {}),
          ...(node.target.step ? { step: node.target.step } : {}),
          ...(node.target.scope ? { scope: node.target.scope } : {}),
          ...(node.target.where ? { where: node.target.where } : {}),
        },
        ...(node.target.target_name ? { target_name: node.target.target_name } : {}),
        ...(node.target.workflow_id ? { workflow_id: node.target.workflow_id } : {}),
      }
    : {}),
  ...(node.entries && node.entries.length > 0 ? { entries: node.entries.map(wireOf) } : {}),
});

export const homeReplyOf = (nodes: HomeNode[]) => ({ entries: nodes.map(wireOf) });

export const section = (key: string, title: string, entries: HomeNode[], over: Partial<HomeNode> = {}): HomeNode => ({ key, title, entries, ...over });

export const rowPage = (key: string, title: string, pageOf: string, entries: HomeNode[], over: Partial<HomeNode> = {}): HomeNode => ({ key, title, page_of: pageOf, entries, ...over });

export const entry = (key: string, title: string, target: Target, over: Partial<HomeNode> = {}): HomeNode => ({ key, title, target, ...over });

export const filesEntry = (key = "files", title = "Files", over: Partial<HomeNode> = {}) => entry(key, title, { type: "files" }, over);

export const startEntry = (key = "start", title = "Start", over: Partial<HomeNode> = {}) => entry(key, title, { type: "start" }, over);

export const ongoingEntry = (key = "ongoing", title = "Ongoing", over: Partial<HomeNode> = {}) => entry(key, title, { type: "ongoing" }, over);

export const backlogEntry = (key: string, title: string, ref: string, over: Partial<HomeNode> = {}) => entry(key, title, { type: "backlog", ref }, over);

export const recordEntry = (key: string, title: string, ref: string, over: Partial<HomeNode> = {}, where?: Condition[]) => entry(key, title, { type: "record", ref, ...(where ? { where } : {}) }, over);

export const workflowEntry = (key: string, title: string, ref: string, workflowName: string, over: Partial<HomeNode> = {}, more: Partial<Target> = {}) =>
  entry(key, title, { type: "workflow", ref, target_name: workflowName, ...more }, over);

export const menuEntry = (key: string, title: string, ref: string, over: Partial<HomeNode> = {}) => entry(key, title, { type: "menu", ref }, over);

export type QuestionFact = string | { prompt: string; answer_type?: string; required?: boolean; options_from?: string };

export type RecordFact = { code: string; key?: string; name: string; canAdd: boolean; workflowId?: string; questions?: QuestionFact[]; rows?: { id: string; order_id?: string; answers: Record<string, string> }[] };

export type RowStepFact = { id: string; record: string; action: "add" | "edit" | "delete"; name: string; replacedBy?: string };

export type SubjectWorkflowFact = { id: string; name: string; record: string };

export type Down = { home?: boolean; roles?: boolean; files?: boolean };

export type Setup = {
  nodes?: HomeNode[];
  down?: Down;
  permissions?: string[];
  roles?: string[];
  membership?: string;
  modules?: string[];
  openWorkflows?: string[];
  waitingSteps?: { workflow: string; id: string; orderId: string }[];
  availableWorkflows?: string[];
  rowSteps?: RowStepFact[];
  subjectWorkflows?: SubjectWorkflowFact[];
  backlogs?: { id: string; name: string }[];
  files?: boolean;
  records?: RecordFact[];
  people?: { id: string; display_name: string }[];
};

export const agencyId = "alego";

export const rowStepOf = (fact: RowStepFact): MemberStep => ({
  ...stepOf(fact.name, fact.id),
  questions: [{ prompt: "Title", answerType: "free_text", helper: "", required: true }],
  state: "start",
  orderId: "",
  recordCode: fact.record,
  earlier: [],
  generated: true,
  rowAction: fact.action,
  ...(fact.replacedBy ? { replacedBy: fact.replacedBy } : {}),
});

export const subjectStepOf = (fact: SubjectWorkflowFact): MemberStep => ({ ...stepOf(fact.name, fact.id), state: "start", orderId: "", recordCode: "", earlier: [], subjectRecord: fact.record });

export const stepOf = (workflowName: string, id = `step-${workflowName}`): StartStep => ({ id, title: workflowName, formName: workflowName, roleName: "Farmer", workflowName, agencyName: "Alego", questions: [] });

const backlogOf = (row: { id: string; name: string }): Backlog => ({ id: row.id, name: row.name, steps: ["to-do", "done"], issues: 1 });

const holds = (answer: string, condition: Condition) => {
  const wanted = typeof condition.value === "string" ? condition.value : "";
  if (condition.operator === "is") return answer === wanted;
  if (condition.operator === "is_not") return answer !== wanted;
  if (condition.operator === "contains") return answer.toLowerCase().includes(wanted.toLowerCase());
  return true;
};

const servedOf = (record: RecordFact) => ({ key: record.key ?? record.code, code: record.code, name: record.name, can_add_rows: record.canAdd, workflow_id: record.workflowId, questions: record.questions ?? [] });

export const hubOf = (setup: Setup = {}) => {
  return vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool, args) => {
    if (tool === homeTool) {
      if (setup.down?.home) throw new Error("wakala answered 500: boom");
      return homeReplyOf(setup.nodes ?? []);
    }
    if (tool === rolesTool) {
      if (setup.down?.roles) throw new Error("wakala answered 500: boom");
      return { instance_id: agencyId, membership: setup.membership ?? "agent", roles: (setup.roles ?? []).map((code) => ({ id: `id-${code}`, code, name: code })), permissions: setup.permissions ?? [] };
    }
    if (tool === liveRecordsTool) {
      return { items: (setup.records ?? []).map((record) => recordServed(servedOf(record))) };
    }
    if (tool === liveRowsTool) {
      const { record_code: code, where = [], order_id: orderId } = (args ?? {}) as { record_code?: string; where?: Condition[]; order_id?: string };
      const record = (setup.records ?? []).find((one) => (one.key ?? one.code) === code || one.code === code);
      const rows = (record?.rows ?? []).filter((row) => (!orderId || row.order_id === orderId) && where.every((condition) => holds(row.answers[condition.question] ?? "", condition)));
      return { items: record ? rows.map((row) => rowServed(servedOf(record), row)) : [] };
    }
    if (tool === "actor_get_actors") {
      const { id = [] } = (args ?? {}) as { id?: string[] };
      return { items: (setup.people ?? []).filter((person) => id.includes(person.id)) };
    }
    return { items: [] };
  });
};

export const wiringOf = (setup: Setup = {}) => {
  const permissions = setup.permissions ?? [];
  return {
    agency: { read: async () => ({ name: "Alego", modules: (setup.modules ?? ["taskmanager"]).map((code) => ({ code, name: code })) }) },
    start: { openSteps: async () => [...(setup.openWorkflows ?? []).map((name) => stepOf(name)), ...(setup.waitingSteps ?? []).map((waiting) => ({ ...stepOf(waiting.workflow, waiting.id), orderId: waiting.orderId }))] },
    steps: { available: async () => [...(setup.availableWorkflows ?? []).map((name) => stepOf(name)), ...(setup.rowSteps ?? []).map(rowStepOf), ...(setup.subjectWorkflows ?? []).map(subjectStepOf)] as never[] },
    backlogs: { backlogs: async () => (setup.backlogs ?? []).map(backlogOf) } as never,
    mayRead: async () => permissions.includes("task.read"),
    files: {
      mounted: async () => {
        if (setup.down?.files) throw new Error("wakala answered 500: boom");
        return setup.files === true;
      },
    },
  };
};

export const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

export const forgetWide = () => {
  Reflect.deleteProperty(window, "matchMedia");
};

export let landed = "";

export let landedState: unknown = null;

export let landedSearch = "";

export const forgetLanded = () => {
  landed = "";
  landedState = null;
  landedSearch = "";
};

export const Where = () => {
  const location = useLocation();
  landed = location.pathname;
  landedState = location.state;
  landedSearch = location.search;
  return null;
};

const pagesOf = (setup: Setup) => {
  const wiring = wiringOf(setup);
  return (
    <Routes>
      <Route path={homeRoute} element={<AgencyHomeScreen {...wiring} />} />
      <Route path={sectionRoute} element={<SectionScreen {...wiring} />} />
      <Route path={recordRoute} element={<RecordRowsScreenOfHome {...wiring} />} />
      <Route path={rowPageRoute} element={<RowPageScreen {...wiring} />} />
      <Route path={waitingRoute} element={<WaitingScreen {...wiring} />} />
      <Route path="*" element={null} />
    </Routes>
  );
};

export const showAt = (path: string, setup: Setup = {}, state?: unknown) => {
  const hub = hubOf(setup);
  const shown = render(
    <MemoryRouter initialEntries={[{ pathname: path.split("?")[0], search: path.includes("?") ? `?${path.split("?")[1]}` : "", state }]}>
      {pagesOf(setup)}
      <Where />
    </MemoryRouter>,
  );
  return Object.assign(shown, { hub });
};

export const showHome = (setup: Setup = {}) => showAt(homePathOf(agencyId), setup);

export const showSection = (key: string, setup: Setup = {}, state?: unknown) => showAt(sectionPathOf(agencyId, key), setup, state);

export const showRecord = (code: string, setup: Setup = {}, entryKey = "farm-list", state?: unknown) => showAt(recordPathOf(agencyId, entryKey, code), setup, state);

export const showRowPage = (rowId: string, key: string, setup: Setup = {}) => showAt(rowPagePathOf(agencyId, key, rowId), setup);

export const rowTitles = (container: HTMLElement) => Array.from(container.querySelectorAll("button.row .ttl")).map((title) => title.textContent);

export const toolsTitles = ["Tools", "Zana", "Eszközök"];

export const rowsBelowStrip = (container: HTMLElement) => rowTitles(container).filter((title) => !/^You have /.test(title ?? "") && !toolsTitles.includes(title ?? ""));

export const rowOf = (container: HTMLElement, title: string) => Array.from(container.querySelectorAll("button.row")).find((row) => row.querySelector(".ttl")?.textContent === title) as HTMLElement;

export const emptyCardOf = (container: HTMLElement) => container.querySelector(".card.empty");

export const needsYouWords = (count: number) => `You have ${count} ${count === 1 ? "thing" : "things"} to do`;

export const useLanguageCode = (code: string) => window.localStorage.setItem("hub.language", code);

export const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

export const everyFact: Setup = {
  permissions: ["task.read", "resident.read"],
  modules: ["taskmanager", "actor", "forms", "digitaltwin", "assetmanager", "council", "accounting"],
  openWorkflows: ["Record a visit"],
  backlogs: [{ id: "b1", name: "Work" }],
  files: true,
};
