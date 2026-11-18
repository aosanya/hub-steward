import { useNavigate } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { useLanguage } from "../../../../shared/language/language";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { groupTypeWord } from "../../groupTypeWords";
import { householdTypes } from "../residents/householdTypes";
import { residentPaths } from "../residents/paths";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadHouseholds = async (areaId: string) =>
  (itemsOf(await callTool("", "actor_list_group_children", { parent_id: areaId })) as Item[]).filter((group) => householdTypes.has(textOf(group.node_type).toLowerCase()));

export function HouseholdsCard({ areaId }: { areaId: string }) {
  const word = useWord();
  const { words } = useLanguage();
  const navigate = useNavigate();
  const view = useLoad(() => loadHouseholds(areaId), `area-households:${openAgencyId()}:${areaId}`);
  if (view.state !== "ready") return null;
  const title = word("Households");
  return (
    <Section
      icon="users"
      word={title}
      opens={() => navigate(residentPaths.households.path())}
      empty={{ words: `No ${title.toLowerCase()} yet.` }}
      rows={view.data.map((household) => (
        <ListRow
          key={textOf(household.id)}
          title={textOf(household.name)}
          meta={groupTypeWord(textOf(household.node_type), words)}
          end="›"
          onClick={() => navigate(residentPaths.households.path({ group: textOf(household.id) }))}
        />
      ))}
    />
  );
}
