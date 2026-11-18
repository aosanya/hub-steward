import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { GroupEdit, loadGroup } from "./GroupScreen";
import { residentPaths } from "./paths";

type Props = { home: "groups" | "households" };

export function GroupEditScreen({ home }: Props) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const view = useLoad(() => loadGroup(id), `group-edit:${openAgencyId()}:${id}`);
  const back = () => navigate(residentPaths[home].path({ group: id }));
  const name = view.state === "ready" && typeof view.data.name === "string" ? view.data.name : "";
  return (
    <Shell title="Edit group" titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" ? (
        <div className="person-page">
          <GroupEdit group={view.data} onDone={back} />
        </div>
      ) : null}
    </Shell>
  );
}
