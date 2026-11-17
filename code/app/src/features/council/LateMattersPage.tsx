import { IssueWindow } from "../../app/menu/sections/issues/IssueScreens";
import { filled } from "../../features/risks/labels";
import { useLanguage } from "../../shared/language/language";
import { Chip } from "../../shared/ui/Chip";
import { longestLateFirst, lateMattersTool, mcpLateMattersClient, type LateMattersClient } from "./lateMattersApi";

const fields = { title: "title", meta: "meta" };

export function LateMattersPage({ client = mcpLateMattersClient }: { client?: LateMattersClient }) {
  const { words } = useLanguage();
  const fetch = async () =>
    longestLateFirst(await client.list()).map((matter) => ({
      id: matter.id,
      title: matter.title,
      meta: [matter.place, matter.owner].filter(Boolean).join(" · "),
      department: matter.owner,
      daysLate: matter.daysLate,
    }));
  return (
    <IssueWindow
      title={words.lateMattersTitle}
      tool={lateMattersTool}
      fields={fields}
      empty={words.lateMattersEmpty}
      fetch={fetch}
      end={(matter) => <Chip>{filled(words.daysLate, { days: Number(matter.daysLate) })}</Chip>}
      loadingWords={words.lateMattersLoading}
      failedWords={words.lateMattersFailed}
    />
  );
}
