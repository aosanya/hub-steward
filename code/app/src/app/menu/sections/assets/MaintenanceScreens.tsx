import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { FactsCard } from "../../FactsCard";
import { assetIdKey, loadAssetCategories } from "../../assetChoices";
import { loadRecordRow, recordRowIdKey } from "../../liveRecordRows";
import { PageFrame } from "../../PageFrame";
import { ChatAboutRecord } from "../residents/ChatAboutRecord";
import { RecordEditAct } from "../../RecordEditAct";
import { RecordEditScreen } from "../../RecordEditScreen";
import { RecordRowForm } from "../../RecordRowForm";
import { maintenanceFields, maintenanceRecordCode } from "./maintenanceRecords";
import { assetPathOf, assetPaths, maintenancePaths } from "./paths";

const prompts = maintenanceFields.map((field) => field.prompt);

const recordPageWord = "Maintenance detail";

const workOrderPrompt = "Work order";

const assetPrompt = "Asset";

const answerOf = (row: Record<string, string>, prompt: string) => row[prompt] ?? "";

const quietLineOf = (row: Record<string, string>) => [answerOf(row, "Kind"), dayWords(answerOf(row, "Date done")), answerOf(row, "Done by")].filter(Boolean).join(" · ");

export function MaintenanceRecordScreen() {
  const { rowId = "" } = useParams();
  const navigate = useNavigate();
  const view = useLoad(() => loadRecordRow(maintenanceRecordCode, rowId, prompts, undefined, [assetPrompt]), `maintenance-record:${openAgencyId()}:${rowId}`);
  const categories = useLoad(loadAssetCategories, `asset-categories:${openAgencyId()}`);
  if (view.state !== "ready" || !view.data[recordRowIdKey]) {
    return (
      <Shell title="Maintenance" backLabel="Assets & Works" onBack={() => navigate(assetPaths.routes.path())}>
        {view.state === "loading" ? <LoadingLine /> : <LoadFailed words="This could not be loaded." />}
      </Shell>
    );
  }
  const row = view.data;
  const facts = prompts.filter((prompt) => prompt !== workOrderPrompt && prompt !== assetPrompt).map((prompt): [string, string] => [prompt, answerOf(row, prompt)]);
  const assetId = answerOf(row, assetIdKey(assetPrompt));
  const category = categories.state === "ready" ? categories.data.get(assetId) : undefined;
  const assetPath = category ? assetPathOf(category, assetId) : "";
  const assetRows = answerOf(row, assetPrompt) === "" ? [] : [<ListRow key="asset" title={answerOf(row, assetPrompt)} onClick={assetPath ? () => navigate(assetPath) : undefined} />];
  const edit = <RecordEditAct recordCode={maintenanceRecordCode} to={maintenancePaths.edit.path({ id: rowId })} />;
  return (
    <Shell title="Maintenance" backLabel="Assets & Works" onBack={() => navigate(assetPaths.routes.path())}>
      <PageFrame title={answerOf(row, "What was done")} line={quietLineOf(row)}>
        <ChatAboutRecord row={row} titlePrompt="What was done" prompts={prompts} chat={{ kind: "maintenance", back: (id) => maintenancePaths.record.path({ rowId: id }) }} />
        <Section word={assetPrompt} plain rows={assetRows} />
        <FactsCard word={recordPageWord} facts={facts} foot={edit} />
        <FactsCard word={workOrderPrompt} facts={[[workOrderPrompt, answerOf(row, workOrderPrompt)]]} />
      </PageFrame>
    </Shell>
  );
}

export function MaintenanceEditScreen() {
  return <RecordEditScreen title="Edit maintenance" recordCode={maintenanceRecordCode} fields={maintenanceFields} back={{ to: (id) => maintenancePaths.record.path({ rowId: id }), label: "Maintenance" }} />;
}

export function MaintenanceAddScreen() {
  const [query] = useSearchParams();
  const asset = query.get("asset") ?? "";
  const from = query.get("from") ?? assetPaths.routes.path();
  return <RecordRowForm title="Add maintenance" recordCode={maintenanceRecordCode} fields={maintenanceFields} back={{ to: from, label: "Back" }} initial={asset ? { Asset: asset } : undefined} />;
}
