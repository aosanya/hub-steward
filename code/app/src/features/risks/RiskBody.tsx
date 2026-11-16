import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../forms/useLoad";
import { routes } from "../../app/routes";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { SectionHeading } from "../../shared/ui/SectionHeading";
import { isoDay } from "../../shared/ui/days";
import type { RiskDetail, RisksClient, Safeguard, Side } from "./api";
import { filled, labelOf, standingTone } from "./labels";

export function RiskBody({ detail }: { detail: RiskDetail }) {
  const { words } = useLanguage();
  const go = useNavigate();
  const { risk, ratings, safeguards, actions } = detail;
  const evidenceWords = (count: number) => filled(count === 1 ? words.safeguardEvidenceOne : words.safeguardEvidenceMany, { count });

  const side = (which: Side, heading: string) => {
    const rows = safeguards.filter((safeguard: Safeguard) => safeguard.side === which);
    return (
      <>
        <SectionHeading>{heading}</SectionHeading>
        {rows.length === 0 ? (
          <EmptyCard words={words.riskNoSafeguards} />
        ) : (
          <Rows>
            {rows.map((row) => (
              <ListRow
                key={row.barrierId}
                title={row.control}
                meta={[row.pathway, evidenceWords(row.evidenceCount)]}
                end={<Chip tone={standingTone(row.standing)}>{labelOf(words, "standing", row.standing)}</Chip>}
                onClick={() => go(routes.riskEvidence.path({ riskId: risk.id, barrierId: row.barrierId }))}
              />
            ))}
          </Rows>
        )}
      </>
    );
  };

  return (
    <>
      <Card>
        <p className="meta">{words.riskTopEvent}</p>
        <p>{risk.topEvent}</p>
      </Card>
      {ratings.length > 0 ? (
        <>
          <SectionHeading>{words.riskRatings}</SectionHeading>
          <Rows>
            {ratings.map((rating) => (
              <ListRow key={rating.kind} title={labelOf(words, "rating", rating.kind)} end={<Chip>{`${labelOf(words, "band", rating.band)} · ${rating.score}`}</Chip>} />
            ))}
          </Rows>
        </>
      ) : null}
      {side("threat", words.riskThreats)}
      {side("consequence", words.riskConsequences)}
      <SectionHeading>{words.riskActions}</SectionHeading>
      {actions.length === 0 ? (
        <EmptyCard words={words.riskNoActions} />
      ) : (
        <Rows>
          {actions.map((action) => (
            <ListRow
              key={action.id}
              title={action.title}
              meta={action.dueAt ? filled(words.riskDue, { date: isoDay(action.dueAt) }) : undefined}
              end={<Chip>{labelOf(words, "actionStatus", action.status)}</Chip>}
            />
          ))}
        </Rows>
      )}
    </>
  );
}

export function RiskPane({ client, riskId }: { client: RisksClient; riskId: string }) {
  const { words } = useLanguage();
  const loaded = useLoad(() => client.risk(riskId), `risk-${riskId}`);
  return (
    <>
      <h2 className="wf-head">{loaded.state === "ready" ? loaded.data.risk.title : words.risksTitle}</h2>
      <div className="wf-content">
        {loaded.state === "loading" ? <LoadingLine words={words.riskLoading} /> : null}
        {loaded.state === "error" ? <LoadFailed words={words.riskFailed} /> : null}
        {loaded.state === "ready" ? <RiskBody detail={loaded.data} /> : null}
      </div>
    </>
  );
}
