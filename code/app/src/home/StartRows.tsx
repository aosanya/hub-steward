import { useNavigate } from "react-router-dom";
import type { AgencyView } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { mcpStartClient, startPath, type StartClient, type StartStep } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";
import { useLoad } from "../forms/useLoad";
import { ListRow, Rows } from "../ui/ListRow";
import { LoadFailed } from "../ui/LoadState";
import { chatTab } from "../tabs";
import { homeCardsFor, type AgencyKind, type HomeCard } from "./cards";
import { chatScreenOf, screenOf } from "./workflowScreens";

const waitingRowOf = (step: StartStep): HomeCard => ({ title: step.formName || step.title, path: startPath(step.id) });

const stepRowOf = (step: StartStep): HomeCard[] => {
  const path = screenOf(step);
  return path ? [{ title: step.formName, path }] : [];
};

type Row = HomeCard & { chat?: true };

const chatRowsOf = (steps: StartStep[]): Row[] => {
  const named = steps.filter((step) => step.opensIn === "chat" && step.workflowName !== "");
  return named
    .filter((step, at) => named.findIndex((other) => other.workflowName === step.workflowName) === at)
    .map((step) => ({ title: step.workflowName, path: chatScreenOf(step), chat: true }));
};

const withoutRepeats = (rows: Row[]) => rows.filter((row, at) => row.chat || rows.findIndex((other) => !other.chat && other.path === row.path) === at);

export function StartRows({
  kind,
  view,
  start = mcpStartClient,
}: {
  kind?: AgencyKind;
  view?: AgencyView | null;
  start?: Pick<StartClient, "openSteps" | "waiting">;
}) {
  const navigate = useNavigate();
  const waiting = useStartWaiting(start) ?? [];
  const steps = useLoad(() => start.openSteps(), `start-rows:${openAgencyId()}`);
  const cards = kind ? homeCardsFor(kind, view) : [];
  const stepRows = steps.state === "ready" ? steps.data.flatMap(stepRowOf) : [];
  const chatRows = steps.state === "ready" ? chatRowsOf(steps.data) : [];
  const rows = withoutRepeats([...waiting.map(waitingRowOf), ...chatRows, ...cards, ...stepRows]);
  return (
    <>
      {rows.length > 0 ? (
        <Rows>
          {rows.map((row) => (
            <ListRow
              key={row.chat ? `chat:${row.title}` : row.path}
              title={row.title}
              start={row.chat ? <span className="mark" aria-hidden="true">{chatTab.glyph}</span> : undefined}
              end="›"
              onClick={() => navigate(row.path)}
            />
          ))}
        </Rows>
      ) : null}
      {steps.state === "error" ? <LoadFailed words="Your apps could not be loaded." /> : null}
    </>
  );
}
