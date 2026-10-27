import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import * as agent from "../../data/agent";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx, type ConsoleContext } from "../../shell/context";
import { useNoticeState } from "../../shell/useNoticeState";
import { NoticeCtx } from "../../ui";
import { AgentEdit } from "./AgentEdit";

export const english = {
  en: {
    agentTabModel: "Model",
    agentTabLimits: "Limits",
    agentTabInstructions: "Instructions",
    agentModel: "Model",
    "agent.noModel": "No model: this agent cannot speak.",
    agentSaveChanges: "Save changes",
    agentApplies: "Applies",
    agentNoLimit: "No limit",
    agentZeroNone: "Zero means none.",
    "agent.modelMax": "model max {max}",
    "agent.inForceUsed": "in force {force}, used {used}",
    "agent.stopped": "Stopped",
    "agent.stopCard": "Why the {agent} stopped",
    "agent.version": "Version {n}",
    "agent.colVersion": "Version",
    "agent.colSaved": "Saved",
    "agent.instrAgencyCard": "From the agency (read-only)",
    "agent.instrNotUsed": "Not used. The role runs on the fine-tuning alone.",
    "agent.instrNoAgency": "The agency has no instructions for this role.",
    "agent.instrYours": "Your fine-tuning",
    "agent.instrNothingRecorded": "Nothing is recorded until you press Save.",
    "agent.previewBoth": "Preview, both together",
    "agent.previewAlone": "Preview, the fine-tuning alone",
    "models.choose": "Choose a model",
    "ui.answerTo": "Answer to:",
    "ui.answerFromChat": "Answer from the chat",
    "ui.clear": "Clear",
    save: "Save",
    cancel: "Cancel",
    submitFailed: "The change could not be sent.",
    "notice.agentSaved": "The agent's settings were saved.",
    "notice.dismiss": "Dismiss",
    loadFailed: "The page could not be loaded.",
    noRows: "Nothing here yet.",
    "agent.stopQuestion": "Why did the {agent} stop?",
    stopLimit: "Limit",
    stopSetOn: "Set on",
    stopPosted: "Posted in the room",
    instrFineTuning: "Fine-tuning",
    instrUseAgency: "Use the agency's instructions",
    instrShowEarlier: "Show the earlier versions",
    instrRestore: "Restore",
    instrNoEarlier: "No earlier versions yet",
    "instrSource.agency": "Agency",
    "instrSource.role": "Role",
    "instrSource.seat_description": "From the seat's description",
    "instrSource.objectives": "From the objectives it answers for",
    "instrSource.values_rules": "From the values and rules that apply",
    "instrSource.work_item_instructions": "From the work items that serve those objectives",
  },
};

const agentFunctions = [
  "agentRows",
  "saveAgentModel",
  "agentLimits",
  "saveAgentLimits",
  "agentInstructions",
  "saveAgentInstructions",
  "agentRevisions",
  "restoreAgentRevision",
  "agentStopped",
] as const;

export type AgentFunction = (typeof agentFunctions)[number];
export type Replies = Partial<Record<AgentFunction, unknown>>;
export type Call = { fn: AgentFunction; args: unknown[] };

export function stubAgent(replies: Replies) {
  const calls: Call[] = [];
  for (const fn of agentFunctions) {
    const stub = agent[fn] as unknown as (...args: unknown[]) => Promise<unknown>;
    vi.mocked(stub).mockImplementation(async (...args) => {
      calls.push({ fn, args });
      if (!(fn in replies)) throw new Error("unexpected " + fn);
      const entry = replies[fn];
      const reply = typeof entry === "function" ? entry() : entry;
      if (reply instanceof Error) throw reply;
      return reply;
    });
  }
  return calls;
}

export const refused = () => new Error("refused");

export const savedText = "The agent's settings were saved.";
export const failedText = "The change could not be sent.";

export const noticeShowing = async (text: string) => (await screen.findByText(text)).closest(".notice") as HTMLElement;

export const inlineStatusLines = () => document.querySelectorAll("p.foot");

export const hubRow = { id: "h1", name: "Siaya Boda Boda Riders", role: "owner", model_key_set: true };

const consoleValue: ConsoleContext = {
  hub: hubRow,
  page: "agent-edit",
  setBadges: () => {},
  refreshMenu: () => {},
};

function NoticeStage({ children }: { children: ReactNode }) {
  const notice = useNoticeState(consoleValue.hub.id);
  return <NoticeCtx.Provider value={notice}>{children}</NoticeCtx.Provider>;
}

export function renderAgentEdit(path: string, replies: Replies) {
  const calls = stubAgent(replies);
  render(
    <I18nProvider initial={english}>
      <MemoryRouter initialEntries={[path]}>
        <ConsoleCtx.Provider value={consoleValue}>
          <NoticeStage>
            <Routes>
              <Route path="/h/:hubId/agent-edit/:role/:tab" element={<AgentEdit />} />
            </Routes>
          </NoticeStage>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
  return calls;
}
