import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import type { AgencyView } from "../../features/agency/modules";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { isGroupOrderForm, mcpStartClient, startPath, type StartClient, type StartStep } from "../../features/market/start/api";
import { useStartWaitingState } from "../../features/market/start/startWaiting";
import { liveClient as liveForms, type FormsClient } from "../../features/forms/api";
import { useLoad } from "../../features/forms/useLoad";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { Button } from "../../shared/ui/Button";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { chatTab, startTab } from "../tabs";
import { chatListPath, doSomethingPath, routes } from "../routes";
import { mcpStepsClient, type MemberStep, type StepsClient } from "../../features/steps/api";
import { loadRowTitles, rowTitleKey } from "../menu/declaredRecord";
import { sentAfter, sentSteps, wasSent } from "../../features/steps/sent";
import { homeCardsFor, type AgencyKind, type HomeCard } from "./cards";
import { chatScreenOf, hasScreen, screenOf } from "./workflowScreens";
import { Icon } from "../../shared/ui/Icon";

const waitingRowOf = (step: StartStep): HomeCard => ({ title: step.formName || step.title, path: startPath(step.id) });

const stepRowOf = (step: StartStep): HomeCard[] => {
  const path = screenOf(step);
  return path ? [{ title: step.formName, path }] : [];
};

type Row = HomeCard & { chat?: true; sent?: boolean; after?: string; subject?: string };

type Titles = Record<string, string>;

type Available = { steps: MemberStep[]; titles: Titles };

const chatRowsOf = (steps: StartStep[]): Row[] => {
  const named = steps.filter((step) => step.opensIn === "chat" && step.workflowName !== "");
  return named
    .filter((step, at) => named.findIndex((other) => other.workflowName === step.workflowName) === at)
    .map((step) => ({ title: step.workflowName, path: chatScreenOf(step), chat: true }));
};

const hasOwnTools = (step: MemberStep) => hasScreen(step) || isGroupOrderForm(step) || step.opensIn === "chat";

const generic = (step: MemberStep) => step.formName || step.title;

const stepPathOf = (step: { id: string; orderId: string }) => routes.step.path({ stepId: step.id }, step.orderId ? { order: step.orderId } : undefined);

const startsRowOnly = (step: MemberStep) => step.generated !== true || (step.rowAction === "add" && !step.replacedBy);

const hasNoSubject = (step: MemberStep) => step.state === "waiting" || !step.subjectRecord;

const subjectPickOf = (step: MemberStep) => (step.state === "waiting" && step.subjectRecord && step.recordCode && step.rowId ? { record: step.recordCode, rowId: step.rowId } : undefined);

const readTitles = (steps: MemberStep[]): Promise<Titles> => {
  const picks = steps.flatMap((step) => subjectPickOf(step) ?? []);
  return picks.length === 0 ? Promise.resolve({}) : loadRowTitles(picks).catch(() => ({}));
};

const loadAvailable = async (members: Pick<StepsClient, "available">): Promise<Available> => {
  const steps = await members.available();
  return { steps, titles: await readTitles(steps) };
};

const subjectOf = (step: MemberStep, titles: Titles) => {
  const pick = subjectPickOf(step);
  return pick ? titles[rowTitleKey(pick)] || undefined : undefined;
};

const rowOfMember = (titles: Titles) => (step: MemberStep): Row =>
  step.generated === true ? { title: step.workflowName || step.title, path: stepPathOf(step) } : { title: generic(step), path: stepPathOf(step), sent: wasSent(step), after: sentAfter(step), subject: subjectOf(step, titles) };

const memberRowsOf = ({ steps, titles }: Available): Row[] => {
  const listed = steps.filter(startsRowOnly).filter(hasNoSubject).filter((step) => generic(step) !== "" && !hasOwnTools(step)).map(rowOfMember(titles));
  const gone = sentSteps().filter((one) => !steps.some((step) => step.id === one.id && step.orderId === one.orderId));
  return [...listed, ...gone.map((one) => ({ title: one.title, path: stepPathOf(one), sent: true, after: one.after }))];
};

const holdsForms = async (forms: Pick<FormsClient, "waiting" | "answered">) => {
  const [waiting, answered] = await Promise.all([forms.waiting(), forms.answered()]);
  return waiting.length + answered.length > 0;
};

const startOrigin = () => ({ path: doSomethingPath(), title: startTab.label });

const withoutRepeats = (rows: Row[]) => rows.filter((row, at) => row.chat || rows.findIndex((other) => !other.chat && other.path === row.path) === at);

export function StartRows({
  kind,
  view,
  start = mcpStartClient,
  steps: members = mcpStepsClient,
  forms = liveForms,
}: {
  kind?: AgencyKind;
  view?: AgencyView | null;
  start?: Pick<StartClient, "openSteps" | "waiting">;
  steps?: Pick<StepsClient, "available">;
  forms?: Pick<FormsClient, "waiting" | "answered">;
}) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const waiting = useStartWaitingState(start);
  const [attempt, setAttempt] = useState(0);
  const key = `${openAgencyId()}:${attempt}`;
  const steps = useLoad(() => start.openSteps(), `start-rows:${key}`);
  const mine = useLoad(() => loadAvailable(members), `start-available:${key}`);
  const formsHeld = useLoad(() => holdsForms(forms), `start-forms:${key}`);
  const formsCardHidden = formsHeld.state === "loading" || (formsHeld.state === "ready" && !formsHeld.data);
  const cards = (kind ? homeCardsFor(kind, view) : []).filter((card) => !(formsCardHidden && card.path === routes.forms.path()));
  const stepRows = steps.state === "ready" ? steps.data.flatMap(stepRowOf) : [];
  const chatRows = steps.state === "ready" ? chatRowsOf(steps.data) : [];
  const memberRows = mine.state === "ready" ? memberRowsOf(mine.data) : memberRowsOf({ steps: [], titles: {} });
  const rows = withoutRepeats([...waiting.steps.filter((step) => !step.orderId).map(waitingRowOf), ...chatRows, ...cards, ...stepRows, ...memberRows]);
  const failed = waiting.status === "failed" || steps.state === "error" || mine.state === "error";
  const reading = waiting.status === "loading" || steps.state === "loading" || mine.state === "loading" || formsHeld.state === "loading";
  const retry = () => {
    setAttempt(attempt + 1);
    waiting.retry();
  };
  return (
    <>
      {rows.length === 0 && kind !== undefined && !failed && !reading ? (
        <EmptyCard words="Nothing to start yet">
          <Button kind="primary" onClick={() => navigate(chatListPath())}>
            Ask in Chat
          </Button>
        </EmptyCard>
      ) : null}
      {rows.length > 0 ? (
        <Rows>
          {rows.map((row) => (
            <ListRow
              key={row.chat ? `chat:${row.title}` : row.path}
              title={row.titleKey ? words[row.titleKey] : row.title}
              start={row.chat ? <span className="mark" aria-hidden="true"><Icon name={chatTab.icon} /></span> : undefined}
              meta={[row.subject, row.after].filter((line): line is string => Boolean(line))}
              end={row.sent ? "Sent" : "›"}
              onClick={row.sent ? undefined : () => navigate(row.path, { state: { from: startOrigin() } })}
            />
          ))}
        </Rows>
      ) : null}
      {rows.length === 0 && kind !== undefined && !failed && reading ? <LoadingLine words="Loading your tasks" /> : null}
      {failed ? <LoadFailed words="Your tasks could not be loaded." onRetry={retry} /> : null}
    </>
  );
}
