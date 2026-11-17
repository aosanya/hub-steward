import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { listOf, text } from "../staff/staffData";

const loadRaised = (personId: string) => async () => {
  const items = await listOf("forms_catalog_raised_item_list_of_person", { raised_by: personId });
  return items
    .map((item) => ({ key: text(item, "id"), title: text(item, "title"), status: text(item, "status"), raisedAt: text(item, "created_at") }))
    .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
};

export function PersonRaised({ id }: { id: string }) {
  const word = useWord("forms");
  const view = useLoad(loadRaised(id), `person-raised:${openAgencyId()}:${id}`);
  if (view.state === "error") return null;
  const raised = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Wishes and issues")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && raised.length === 0 ? <EmptyCard words="Nothing raised yet." /> : null}
      {raised.length > 0 ? (
        <Rows>
          {raised.map((item) => (
            <ListRow key={item.key} title={item.title} meta={`${item.status}, raised ${dayWords(item.raisedAt)}`} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
