import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuEditForm } from "../../MenuEditForm";
import { councilEdits, isEditKind, type EditKind } from "./councilRecords";
import { councilPaths } from "./paths";

export function CouncilEditScreen({ adding }: { adding?: EditKind }) {
  const params = useParams();
  const kind = adding ?? params.kind ?? "";
  const id = adding ? "" : (params.id ?? "");
  const navigate = useNavigate();
  const edit = isEditKind(kind) ? councilEdits[kind] : null;
  const create = adding ? edit?.form.create : undefined;
  const view = useLoad(() => (edit && !adding ? edit.load(id) : Promise.resolve({})), `council-edit:${openAgencyId()}:${kind}:${id}`);
  const back = () => navigate(edit ? (adding ? councilPaths[edit.home].path() : `${councilPaths[edit.home].path()}?id=${id}`) : councilPaths.meetings.path());
  const name = edit && !adding && view.state === "ready" ? edit.nameOf(view.data) : "";
  return (
    <Shell title={edit ? `${adding ? "Add" : "Edit"} ${edit.word}` : "Edit"} titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" || !edit ? <LoadFailed words="This could not be loaded." /> : null}
      {edit && view.state === "ready" ? (
        <div className="person-page">
          <MenuEditForm item={edit.form.item(view.data)} id={id} build={create ? create.build : edit.form.build?.(id, edit.form.item(view.data))} idArg={edit.form.idArg} tool={create ? create.tool : edit.form.tool} permission={edit.form.permission} fields={edit.form.fields} keep={edit.form.keep} bare openCount={1} onSaved={back} onCancel={back} />
        </div>
      ) : null}
    </Shell>
  );
}
