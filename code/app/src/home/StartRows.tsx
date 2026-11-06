import { useNavigate } from "react-router-dom";
import type { AgencyView } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { isGroupOrderForm, mcpStartClient, startPath, type StartClient, type StartStep } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";
import { liveClient as liveForms, type FormsClient } from "../forms/api";
import { useLoad } from "../forms/useLoad";
import { ListRow, Rows } from "../ui/ListRow";
import { Button } from "../ui/Button";
import { EmptyCard, LoadFailed } from "../ui/LoadState";
import { chatTab } from "../tabs";
import { chatListPath, routes } from "../routes";
import { mcpStepsClient, type MemberStep, type StepsClient } from "../steps/api";
import { sentSteps, wasSent } from "../steps/sent";
import { homeCardsFor, type AgencyKind, type HomeCard } from "./cards";
import { chatScreenOf, hasScreen, screenOf } from "./workflowScreens";

const waitingRowOf = (step: StartStep): HomeCard => ({ title: step.formName || step.title, path: startPath(step.id) });

const stepRowOf = (step: StartStep): HomeCard[] => {
  const path = screenOf(step);
  return path ? [{ title: step.formName, path }] : [];
};

type Row = HomeCard & { chat?: true; sent?: boolean };

const chatRowsOf = (steps: StartStep[]): Row[] => {
  const named = steps.filter((step) => step.opensIn === "chat" && step.workflowName !== "");
  return named
    .filter((step, at) => named.findIndex((other) => other.workflowName === step.workflowName) === at)
    .map((step) => ({ title: step.workflowName, path: chatScreenOf(step), chat: true }));
};

const hasOwnTools = (step: MemberStep) => hasScreen(step) || isGroupOrderForm(step) || step.opensIn === "chat";

const generic = (step: MemberStep) => step.formName || step.title;

const stepPathOf = (step: { id: string; orderId: string }) => routes.step.path({ stepId: step.id }, step.orderId ? { order: step.orderId } : undefined);

const memberRowsOf = (steps: MemberStep[]): Row[] => {
  const listed = steps
    .filter((step) => generic(step) !== "" && !hasOwnTools(step))
    .map((step) => ({ title: generic(step), path: stepPathOf(step), sent: wasSent(step) }));
  const gone = sentSteps().filter((one) => !steps.some((step) => step.id === one.id && step.orderId === one.orderId));
  return [...listed, ...gone.map((one) => ({ title: one.title, path: stepPathOf(one), sent: true }))];
};

const holdsForms = async (forms: Pick<FormsClient, "waiting" | "answered">) => {
  const [waiting, answered] = await Promise.all([forms.waiting(), forms.answered()]);
  return waiting.length + answered.length > 0;
};

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
  const waitingRead = useStartWaiting(start);
  const waiting = waitingRead ?? [];
  const steps = useLoad(() => start.openSteps(), `start-rows:${openAgencyId()}`);
  const mine = useLoad(() => members.available(), `start-available:${openAgencyId()}`);
  const formsHeld = useLoad(() => holdsForms(forms), `start-forms:${openAgencyId()}`);
  const formsCardHidden = formsHeld.state === "loading" || (formsHeld.state === "ready" && !formsHeld.data);
  const cards = (kind ? homeCardsFor(kind, view) : []).filter((card) => !(formsCardHidden && card.path === routes.forms.path()));
  const stepRows = steps.state === "ready" ? steps.data.flatMap(stepRowOf) : [];
  const chatRows = steps.state === "ready" ? chatRowsOf(steps.data) : [];
  const memberRows = mine.state === "ready" ? memberRowsOf(mine.data) : memberRowsOf([]);
  const rows = withoutRepeats([...waiting.map(waitingRowOf), ...chatRows, ...cards, ...stepRows, ...memberRows]);
  const settled = kind !== undefined && waitingRead !== null && steps.state === "ready" && mine.state !== "loading" && formsHeld.state !== "loading";
  return (
    <>
      {rows.length === 0 && settled ? (
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
              title={row.title}
              start={row.chat ? <span className="mark" aria-hidden="true">{chatTab.glyph}</span> : undefined}
              end={row.sent ? "Sent" : "›"}
              onClick={row.sent ? undefined : () => navigate(row.path)}
            />
          ))}
        </Rows>
      ) : null}
      {steps.state === "error" ? <LoadFailed words="Your apps could not be loaded." /> : null}
    </>
  );
}
