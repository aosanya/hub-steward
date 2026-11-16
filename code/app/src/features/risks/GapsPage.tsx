import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../forms/useLoad";
import { routes } from "../../app/routes";
import { Chip } from "../../shared/ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { Shell } from "../../app/Shell";
import { mcpRisksClient, type RisksClient } from "./api";

export function GapsPage({ client = mcpRisksClient }: { client?: RisksClient }) {
  const { words } = useLanguage();
  const go = useNavigate();
  const gaps = useLoad(() => client.myGaps(), "gaps");
  return (
    <Shell title={words.gapsTitle}>
      {gaps.state === "loading" ? <LoadingLine words={words.gapsLoading} /> : null}
      {gaps.state === "error" ? <LoadFailed words={words.gapsFailed} /> : null}
      {gaps.state === "ready" && gaps.data.length === 0 ? <EmptyCard words={words.gapsEmpty} /> : null}
      {gaps.state === "ready" && gaps.data.length > 0 ? (
        <Rows>
          {gaps.data.map((gap) => (
            <ListRow
              key={`${gap.kind}-${gap.subjectId}`}
              title={gap.subject}
              meta={gap.message}
              end={<Chip>{gap.severity}</Chip>}
              onClick={() => go(routes.risk.path({ riskId: gap.riskId }))}
            />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}
