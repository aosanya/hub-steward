import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { PersonEdit } from "./PersonEdit";
import { loadPerson } from "./PersonScreen";
import { residentPaths } from "./paths";
import { personNameOf } from "./personName";

export function PersonEditScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const view = useLoad(() => loadPerson(id), `person-edit:${openAgencyId()}:${id}`);
  const back = () => navigate(residentPaths.people.path({ person: id }));
  const name = view.state === "ready" ? personNameOf(view.data) : "";
  return (
    <Shell title="Edit details" titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" ? (
        <div className="person-page">
          <PersonEdit id={id} person={view.data} onDone={back} />
        </div>
      ) : null}
    </Shell>
  );
}
