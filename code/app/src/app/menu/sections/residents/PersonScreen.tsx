import { useParams } from "react-router-dom";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuDetail } from "../../MenuDetail";
import { useBackToSection } from "../../useBackToSection";

type Item = Record<string, unknown>;

const nameOf = (group: Item) => (typeof group.name === "string" ? group.name : "");

const loadPerson = async (id: string) => {
  const reply = (await callTool("", "actor_get_actor", { actor_id: id })) as { item?: Item } | Item | null;
  const person = (reply as { item?: Item } | null)?.item ?? reply;
  return (person && typeof person === "object" ? person : {}) as Item;
};

function PersonGroups({ id }: { id: string }) {
  const view = useLoad(async () => itemsOf(await callTool("", "actor_list_groups_for_actor", { actor_id: id })) as Item[], `person-groups:${openAgencyId()}:${id}`);
  const names = view.state === "ready" ? view.data.map(nameOf).filter(Boolean) : [];
  return (
    <>
      <SectionHeading>Groups</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="The groups could not be loaded." /> : null}
      {view.state === "ready" && names.length === 0 ? <EmptyCard words="Not in any group yet." /> : null}
      {names.length > 0 ? (
        <Rows>
          {names.map((name) => (
            <ListRow key={name} title={name} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}

export function PersonScreen() {
  const back = useBackToSection();
  const id = useParams().id ?? "";
  return (
    <Shell title="Person" titleUnder {...back}>
      <MenuDetail bare title="Person" tool="actor_get_actor" fields={{ Name: "display_name" }} status="status" id={id} load={loadPerson} />
      <PersonGroups id={id} />
    </Shell>
  );
}
