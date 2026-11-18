import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
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
  if (view.state === "error" || view.state === "loading") return null;
  return <Section word={word("Works")} all icon="clock" empty={{ words: "No works yet." }} rows={view.data.map((work) => <ListRow key={work.key} title={work.title} meta={work.meta} />)} />;
}
