import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { useMayAnswer } from "../../../../features/agency/useMay";
import { groupCreateTool, groupNameFields } from "../../groupEdit";
import { MenuEditForm } from "../../MenuEditForm";
import { GroupEdit, loadGroup } from "./GroupScreen";
import { residentPaths } from "./paths";

type Item = Record<string, unknown>;

type Adding = { nodeType: string; word: string; listPath: () => string };

type Props = { home?: "groups" | "households"; backTo?: (id: string) => string; adding?: Adding };

const groupManage = "group.manage";

function GroupAdd({ nodeType, onDone }: { nodeType: string; onDone: () => void }) {
  const { known, may } = useMayAnswer(groupManage);
  if (known && !may) return <LoadFailed words="You may not add this." />;
  const build = (sent: Record<string, unknown>) => ({ name: String(sent.name ?? "").trim(), node_type: nodeType });
  return <MenuEditForm item={{}} id="" idArg="" tool={groupCreateTool} permission={groupManage} fields={groupNameFields} build={build} bare openCount={1} onSaved={onDone} onCancel={onDone} />;
}

export function GroupEditScreen({ home = "groups", backTo, adding }: Props) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const view = useLoad((): Promise<Item> => (adding ? Promise.resolve({}) : loadGroup(id)), `group-edit:${openAgencyId()}:${adding?.nodeType ?? ""}:${id}`);
  const back = () => navigate(adding ? adding.listPath() : backTo ? backTo(id) : residentPaths[home].path({ group: id }));
  const name = view.state === "ready" && typeof view.data.name === "string" ? view.data.name : "";
  return (
    <Shell title={adding ? `Add ${adding.word}` : "Edit group"} titleUnder onBack={back} backLabel={adding ? `All ${adding.word}s` : name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" ? (
        <div className="person-page">{adding ? <GroupAdd nodeType={adding.nodeType} onDone={back} /> : <GroupEdit group={view.data} onDone={back} />}</div>
      ) : null}
    </Shell>
  );
}
