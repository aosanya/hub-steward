import { useNavigate } from "react-router-dom";
import { useLoad } from "../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { formFieldsOf, isUnsupported, loadDeclaredRows, mayAddRowsTo, prefillOf, type DeclaredRecord } from "../menu/declaredRecord";
import { RecordRowForm } from "../menu/RecordRowForm";
import { Shell } from "../Shell";
import { useHomeRecordRoute, type HomeRecordRoute } from "./homeRecordRoute";
import { useHomeRecord } from "./useHomeRecord";

export type HomeRecordFormProps = Record<string, unknown>;

const capitalised = (answer: string) => answer.charAt(0).toUpperCase() + answer.slice(1).toLowerCase();

const savedAnswersOf = (record: DeclaredRecord, answers: Record<string, string>) => ({
  fields: Object.fromEntries(record.questions.filter((question) => !isUnsupported(question)).map((question) => [question.prompt, question.answerType === "yes_no" ? capitalised(answers[question.prompt] ?? "") : (answers[question.prompt] ?? "")])),
  kept: Object.fromEntries(record.questions.filter(isUnsupported).map((question) => [question.prompt, answers[question.prompt] ?? ""]).filter(([, answer]) => answer !== "")),
});

const entrySuffix = (route: HomeRecordRoute) => (route.entryKey ? `entry=${encodeURIComponent(route.entryKey)}` : "");

const withQuery = (path: string, ...queries: string[]) => {
  const joined = queries.filter(Boolean).join("&");
  return joined ? `${path}?${joined}` : path;
};

function Editing({ route, record, back, title }: { route: HomeRecordRoute; record: DeclaredRecord; back: { to: string; label: string }; title: string }) {
  const navigate = useNavigate();
  const row = useLoad(async () => (await loadDeclaredRows(record.code, [])).find((one) => one.id === route.editId) ?? null, `home-record-edit:${openAgencyId()}:${route.listPath}:${route.editId}`);
  const listPath = withQuery(route.listPath, entrySuffix(route));
  if (row.state !== "ready" || !row.data) {
    return (
      <Shell title={`Edit row of ${record.name}`} titleUnder backLabel={back.label} onBack={() => navigate(listPath)} tabless>
        {row.state === "loading" ? <LoadingLine /> : <LoadFailed words="This could not be loaded." />}
      </Shell>
    );
  }
  const saved = savedAnswersOf(record, row.data.answers);
  return <RecordRowForm title={`Edit row of ${record.name}`} recordCode={record.code} exactCode fields={formFieldsOf(record)} kept={saved.kept} edit={{ rowId: route.editId, saved: saved.fields }} back={{ to: listPath, label: title, toSaved: (id) => withQuery(route.listPath, `row=${encodeURIComponent(id)}`, entrySuffix(route)) }} />;
}

export function HomeRecordForm(_wiring: HomeRecordFormProps) {
  const route = useHomeRecordRoute();
  if (!route) return null;
  return <Loaded route={route} />;
}

function Loaded({ route }: { route: HomeRecordRoute }) {
  const navigate = useNavigate();
  const view = useHomeRecord(route);
  const listPath = withQuery(route.listPath, entrySuffix(route));
  if (view.state !== "ready" || !view.data.record || !mayAddRowsTo(view.data.record)) {
    return (
      <Shell title="" onBack={() => navigate(listPath)} backLabel="Back" tabless>
        {view.state === "loading" ? <LoadingLine /> : <LoadFailed words={view.state === "ready" ? "You cannot add rows here." : "This could not be loaded."} />}
      </Shell>
    );
  }
  const { record, title, where, back } = view.data;
  if (route.mode === "edit") return <Editing route={route} record={record} back={back} title={title} />;
  return <RecordRowForm title={`Add to ${record.name}`} recordCode={record.code} exactCode fields={formFieldsOf(record)} initial={prefillOf(where ?? [])} back={{ to: listPath, label: title }} />;
}
