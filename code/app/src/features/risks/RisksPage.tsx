import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../forms/useLoad";
import { routes } from "../../app/routes";
import { Chip } from "../../shared/ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { isoDay } from "../../shared/ui/days";
import { Segmented } from "../../shared/ui/Segmented";
import { useWide } from "../../shared/ui/useWide";
import { Shell } from "../../app/Shell";
import { mcpRisksClient, type RisksClient } from "./api";
import { RiskPane } from "./RiskBody";
import { filled, labelOf } from "./labels";
import "../../shared/ui/paneWindow.css";
import "../../app/menu/menuWindow.css";

type View = "risks" | "actions";

export function RisksPage({ client = mcpRisksClient, riskId = "" }: { client?: RisksClient; riskId?: string }) {
  const { words } = useLanguage();
  const go = useNavigate();
  const wide = useWide();
  const [chosen, setChosen] = useState(riskId);
  const [view, setView] = useState<View>("risks");
  const risks = useLoad(() => client.myRisks(), "risks");
  const actions = useLoad(() => client.myActions(), "actions");
  const open = (id: string) => (wide ? setChosen(id) : go(routes.risk.path({ riskId: id })));
  const pressed = (id: string) => (wide ? chosen === id : undefined);
  const list = (
    <>
      <Rows>
        <ListRow title={words.gapsTitle} end="›" onClick={() => go(routes.riskGaps.path())} />
      </Rows>
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
                  pressed={pressed(risk.id)}
                  onClick={() => open(risk.id)}
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
                  pressed={pressed(action.riskId)}
                  onClick={() => open(action.riskId)}
                />
              ))}
            </Rows>
          ) : null}
        </>
      )}
    </>
  );
  if (!wide) return <Shell title={words.risksTitle}>{list}</Shell>;
  return (
    <Shell title={words.risksTitle} tabless>
      <div className="wf">
        <div className="wf-panes">
          <section className="wf-tree mw-list" aria-label={words.risksTitle}>
            {list}
          </section>
          <section className="wf-main" aria-label={chosen ? words.risksTitle : undefined}>
            {chosen ? <RiskPane key={chosen} client={client} riskId={chosen} /> : null}
          </section>
        </div>
        <footer className="wf-status" aria-label="Status bar" />
      </div>
    </Shell>
  );
}
