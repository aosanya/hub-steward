import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../../features/forms/useLoad";
import { filled, labelOf } from "../../features/risks/labels";
import { Chip } from "../../shared/ui/Chip";
import { isoDay } from "../../shared/ui/days";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { SectionHeading } from "../../shared/ui/SectionHeading";
import { Shell } from "../../app/Shell";
import { useBackToSection } from "../../app/menu/useBackToSection";
import { mcpCouncilRisksClient, type CouncilRisksClient } from "./councilRisksApi";

export function CouncilRisksPage({ client = mcpCouncilRisksClient }: { client?: CouncilRisksClient }) {
  const { words } = useLanguage();
  const back = useBackToSection();
  const council = useLoad(() => client.load(), "council-risks");
  const empty = council.state === "ready" && council.data.risks.length === 0 && council.data.overdueActions.length === 0;
  return (
    <Shell title={words.councilRisksTitle} {...back}>
      {council.state === "loading" ? <LoadingLine words={words.councilRisksLoading} /> : null}
      {council.state === "error" ? <LoadFailed words={words.councilRisksFailed} /> : null}
      {empty ? <EmptyCard words={words.councilRisksEmpty} /> : null}
      {council.state === "ready" && !empty ? (
        <>
          {council.data.overdueActions.length > 0 ? <SectionHeading>{words.councilRisksOverdue}</SectionHeading> : null}
          <Rows>
            {council.data.overdueActions.map((action) => (
              <ListRow
                key={action.id}
                title={action.title}
                meta={[action.owner, filled(words.riskDue, { date: isoDay(action.dueAt) })]}
                end={<Chip>{labelOf(words, "actionStatus", action.status)}</Chip>}
              />
            ))}
          </Rows>
          {council.data.risks.length > 0 ? <SectionHeading>{words.councilRisksAll}</SectionHeading> : null}
          <Rows>
            {council.data.risks.map((risk) => (
              <ListRow
                key={risk.id}
                title={risk.title}
                lead
                meta={risk.owner}
                end={<Chip>{labelOf(words, "status", risk.status)}</Chip>}
              />
            ))}
          </Rows>
        </>
      ) : null}
    </Shell>
  );
}
