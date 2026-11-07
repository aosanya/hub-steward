import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { routes } from "../routes";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { isoDay } from "../ui/days";
import { Segmented } from "../ui/Segmented";
import { Shell } from "../ui/Shell";
import { mcpRisksClient, type RisksClient } from "./api";
import { filled, labelOf } from "./labels";

type View = "risks" | "actions";

export function RisksPage({ client = mcpRisksClient }: { client?: RisksClient }) {
  const { words } = useLanguage();
  const go = useNavigate();
  const [view, setView] = useState<View>("risks");
  const risks = useLoad(() => client.myRisks(), "risks");
  const actions = useLoad(() => client.myActions(), "actions");
  return (
    <Shell title={words.risksTitle}>
      <Segmented
        items={[
          { id: "risks", label: words.risksMine },
          { id: "actions", label: words.actionsMine },
        ]}
        current={view}
        onChange={setView}
      />
      {view === "risks" ? (
        <>
          {risks.state === "loading" ? <LoadingLine words={words.risksLoading} /> : null}
          {risks.state === "error" ? <LoadFailed words={words.risksFailed} /> : null}
          {risks.state === "ready" && risks.data.length === 0 ? <EmptyCard words={words.risksEmpty} /> : null}
          {risks.state === "ready" && risks.data.length > 0 ? (
            <Rows>
              {risks.data.map((risk) => (
                <ListRow
                  key={risk.id}
                  title={risk.title}
                  lead
                  meta={risk.topEvent}
                  end={<Chip>{labelOf(words, "status", risk.status)}</Chip>}
                  onClick={() => go(routes.risk.path({ riskId: risk.id }))}
                />
              ))}
            </Rows>
          ) : null}
        </>
      ) : (
        <>
          {actions.state === "loading" ? <LoadingLine words={words.actionsLoading} /> : null}
          {actions.state === "error" ? <LoadFailed words={words.actionsFailed} /> : null}
          {actions.state === "ready" && actions.data.length === 0 ? <EmptyCard words={words.actionsEmpty} /> : null}
          {actions.state === "ready" && actions.data.length > 0 ? (
            <Rows>
              {actions.data.map((action) => (
                <ListRow
                  key={action.id}
                  title={action.title}
                  meta={action.dueAt ? filled(words.riskDue, { date: isoDay(action.dueAt) }) : undefined}
                  end={<Chip>{labelOf(words, "actionStatus", action.status)}</Chip>}
                  onClick={() => go(routes.risk.path({ riskId: action.riskId }))}
                />
              ))}
            </Rows>
          ) : null}
        </>
      )}
    </Shell>
  );
}
