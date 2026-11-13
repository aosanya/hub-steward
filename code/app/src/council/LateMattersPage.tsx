import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { filled } from "../risks/labels";
import { Chip } from "../ui/Chip";
import { ListRow, Rows } from "../ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { longestLateFirst, mcpLateMattersClient, type LateMattersClient } from "./lateMattersApi";

export function LateMattersPage({ client = mcpLateMattersClient }: { client?: LateMattersClient }) {
  const { words } = useLanguage();
  const matters = useLoad(() => client.list().then(longestLateFirst), "late-matters");
  return (
    <Shell title={words.lateMattersTitle}>
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
