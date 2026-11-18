import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { stateAndDue, taskList } from "../assets/WorkPages";
import { linkedRefOf } from "../assets/workOrderAsset";
import { listOf } from "../staff/staffData";
import { textOf } from "./records";

const loadWorks = (assetId: string) => async () => {
  const tasks = await listOf(taskList);
  return tasks
    .filter((task) => linkedRefOf(task) === assetId)
    .map((task) => ({ key: textOf(task.id), title: textOf(task.title), meta: stateAndDue(task) }));
};

export function PropertyWorks({ assetId }: { assetId: string }) {
  const word = useWord("assetmanager");
  const view = useLoad(loadWorks(assetId), `property-works:${openAgencyId()}:${assetId}`);
  if (view.state === "error") return null;
  const works = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Works")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && works.length === 0 ? <EmptyCard words="No works yet." /> : null}
      {works.length > 0 ? (
        <Rows>
          {works.map((work) => (
            <ListRow key={work.key} title={work.title} meta={work.meta} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
