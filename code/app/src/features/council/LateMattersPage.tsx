import { MenuList } from "../../app/menu/MenuList";
import { filled } from "../../features/risks/labels";
import { useLanguage } from "../../shared/language/language";
import { Chip } from "../../shared/ui/Chip";
import { agencyHomePath, openAgencyId } from "../../shared/wakala/openAgency";
import { longestLateFirst, lateMattersTool, mcpLateMattersClient, type LateMattersClient } from "./lateMattersApi";

const fields = { title: "title", meta: "meta" };

export function LateMattersPage({ client = mcpLateMattersClient }: { client?: LateMattersClient }) {
  const { words } = useLanguage();
  const load = async () =>
    longestLateFirst(await client.list()).map((matter) => ({
      id: matter.id,
      title: matter.title,
      meta: [matter.place, matter.owner].filter(Boolean).join(" · "),
      daysLate: matter.daysLate,
    }));
  return (
    <MenuList
      title={words.lateMattersTitle}
      tool={lateMattersTool}
      fields={fields}
      empty={{ words: words.lateMattersEmpty, act: "Home", to: agencyHomePath(openAgencyId()) }}
      load={load}
      end={(matter) => <Chip>{filled(words.daysLate, { days: Number(matter.daysLate) })}</Chip>}
      loadingWords={words.lateMattersLoading}
      failedWords={words.lateMattersFailed}
    />
  );
}
