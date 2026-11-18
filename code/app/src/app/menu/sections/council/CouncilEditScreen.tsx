import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuEditForm } from "../../MenuEditForm";
import { councilEdits, isEditKind } from "./councilRecords";
import { councilPaths } from "./paths";

export function CouncilEditScreen() {
  const { kind = "", id = "" } = useParams();
  const navigate = useNavigate();
  const edit = isEditKind(kind) ? councilEdits[kind] : null;
  const view = useLoad(() => (edit ? edit.load(id) : Promise.resolve({})), `council-edit:${openAgencyId()}:${kind}:${id}`);
  const back = () => navigate(edit ? `${councilPaths[edit.home].path()}?id=${id}` : councilPaths.meetings.path());
  const name = edit && view.state === "ready" ? edit.nameOf(view.data) : "";
  return (
    <Shell title={edit ? `Edit ${edit.word}` : "Edit"} titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" || !edit ? <LoadFailed words="This could not be loaded." /> : null}
      {edit && view.state === "ready" ? (
        <div className="person-page">
          <MenuEditForm item={edit.form.item(view.data)} id={id} build={edit.form.build?.(id, edit.form.item(view.data))} idArg={edit.form.idArg} tool={edit.form.tool} permission={edit.form.permission} fields={edit.form.fields} keep={edit.form.keep} bare openCount={1} onSaved={back} onCancel={back} />
        </div>
      ) : null}
    </Shell>
  );
}
