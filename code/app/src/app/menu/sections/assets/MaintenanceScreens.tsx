import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { FactsCard } from "../../FactsCard";
import { loadRecordRow, recordRowIdKey } from "../../liveRecordRows";
import { PageFrame } from "../../PageFrame";
import { ChatAboutRecord } from "../residents/ChatAboutRecord";
import { RecordEditAct } from "../../RecordEditAct";
import { RecordEditScreen } from "../../RecordEditScreen";
import { RecordRowForm } from "../../RecordRowForm";
import { maintenanceFields, maintenanceRecordCode } from "./maintenanceRecords";
import { assetPaths, maintenancePaths } from "./paths";

const prompts = maintenanceFields.map((field) => field.prompt);

const recordPageWord = "Maintenance detail";

const workOrderPrompt = "Work order";

const answerOf = (row: Record<string, string>, prompt: string) => row[prompt] ?? "";

export function MaintenanceRecordScreen() {
  const { rowId = "" } = useParams();
  const navigate = useNavigate();
  const view = useLoad(() => loadRecordRow(maintenanceRecordCode, rowId, prompts), `maintenance-record:${openAgencyId()}:${rowId}`);
  if (view.state !== "ready" || !view.data[recordRowIdKey]) {
    return (
      <Shell title="Maintenance" titleUnder backLabel="Assets & Works" onBack={() => navigate(assetPaths.routes.path())}>
        {view.state === "loading" ? <LoadingLine /> : <LoadFailed words="This could not be loaded." />}
      </Shell>
    );
  }
  const row = view.data;
  const facts = prompts.filter((prompt) => prompt !== workOrderPrompt).map((prompt): [string, string] => [prompt, answerOf(row, prompt)]);
  const edit = <RecordEditAct recordCode={maintenanceRecordCode} to={maintenancePaths.edit.path({ id: rowId })} />;
  return (
    <Shell title="Maintenance" titleUnder backLabel="Assets & Works" onBack={() => navigate(assetPaths.routes.path())}>
      <PageFrame title={answerOf(row, "What was done")} line={answerOf(row, "Date done")}>
        <ChatAboutRecord row={row} titlePrompt="What was done" prompts={prompts} chat={{ kind: "maintenance", back: (id) => maintenancePaths.record.path({ rowId: id }) }} />
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
