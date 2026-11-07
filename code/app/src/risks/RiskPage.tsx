import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { routes } from "../routes";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { SectionHeading } from "../ui/SectionHeading";
import { Shell } from "../ui/Shell";
import { isoDay } from "../ui/days";
import { mcpRisksClient, type RisksClient, type Safeguard, type Side } from "./api";
import { filled, labelOf, standingTone } from "./labels";

export function RiskPage({ client = mcpRisksClient }: { client?: RisksClient }) {
  const { riskId = "" } = useParams();
  const { words } = useLanguage();
  const go = useNavigate();
  const loaded = useLoad(() => client.risk(riskId), `risk-${riskId}`);
  const back = () => go(routes.risks.path());

  if (loaded.state !== "ready") {
    return (
      <Shell title={words.risksTitle} onBack={back}>
        {loaded.state === "loading" ? <LoadingLine words={words.riskLoading} /> : <LoadFailed words={words.riskFailed} />}
      </Shell>
    );
  }

  const { risk, ratings, safeguards, actions } = loaded.data;
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
    <Shell title={risk.title} sub={labelOf(words, "status", risk.status)} onBack={back}>
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
    </Shell>
  );
}
