import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../../features/forms/useLoad";
import { useBackToSection } from "../../app/menu/useBackToSection";
import { filled } from "../../features/risks/labels";
import { Chip } from "../../shared/ui/Chip";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../../app/Shell";
import { longestLateFirst, mcpLateMattersClient, type LateMattersClient } from "./lateMattersApi";

export function LateMattersPage({ client = mcpLateMattersClient }: { client?: LateMattersClient }) {
  const { words } = useLanguage();
  const back = useBackToSection();
  const matters = useLoad(() => client.list().then(longestLateFirst), "late-matters");
  return (
    <Shell title={words.lateMattersTitle} {...back}>
      {matters.state === "loading" ? <LoadingLine words={words.lateMattersLoading} /> : null}
      {matters.state === "error" ? <LoadFailed words={words.lateMattersFailed} /> : null}
      {matters.state === "ready" && matters.data.length === 0 ? <EmptyCard words={words.lateMattersEmpty} /> : null}
      {matters.state === "ready" && matters.data.length > 0 ? (
        <Rows>
          {matters.data.map((matter) => (
            <ListRow
              key={matter.id}
              title={matter.title}
              meta={[matter.place, matter.owner]}
              end={<Chip>{filled(words.daysLate, { days: matter.daysLate })}</Chip>}
            />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}
