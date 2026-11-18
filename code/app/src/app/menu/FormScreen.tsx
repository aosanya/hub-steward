import { useNavigate } from "react-router-dom";
import { useMayAnswer } from "../../features/agency/useMay";
import { useLoad } from "../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { Shell } from "../Shell";
import { MenuEditForm, type EditField } from "./MenuEditForm";

type Item = Record<string, unknown>;

type Built = (sent: Record<string, unknown>) => Record<string, unknown>;

type Props = {
  id?: string;
  word: string;
  listLabel: string;
  addedTo: string;
  editedTo?: string | ((item: Item) => string);
  permission: string;
  load?: (id: string) => Promise<Item>;
  nameOf?: (item: Item) => string;
  addTool: string;
  addBuild: Built;
  editTool: string;
  idArg: string;
  editBuild?: (item: Item) => Built;
  fields: EditField[] | ((item: Item) => EditField[]);
  keep?: string[];
  seed?: Item;
  check?: (values: Record<string, string>) => string;
  visible?: (key: string, values: Record<string, string>) => boolean;
  sendVersion?: boolean;
};

export function FormScreen({ id = "", word, listLabel, addedTo, editedTo, permission, load, nameOf, addTool, addBuild, editTool, idArg, editBuild, fields, keep, seed, check, visible, sendVersion }: Props) {
  const navigate = useNavigate();
  const { known, may } = useMayAnswer(permission);
  const editing = id !== "";
  const view = useLoad(() => (editing && load ? load(id) : Promise.resolve(seed ?? {})), `form:${openAgencyId()}:${word}:${id}`);
  const settled = editing && view.state === "ready" && typeof editedTo === "function" ? editedTo(view.data) : editedTo;
  const leave = () => navigate(editing ? (typeof settled === "string" ? settled : addedTo) : addedTo);
  const name = editing && view.state === "ready" && nameOf ? nameOf(view.data) : "";
  return (
    <Shell title={`${editing ? "Edit" : "Add"} ${word}`} titleUnder backLabel={editing ? name || "Back" : listLabel} onBack={leave} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" && known && !may ? <LoadFailed words={editing ? "You may not change this." : "You may not add this."} /> : null}
      {view.state === "ready" && known && may ? (
        <div className="person-page">
          <MenuEditForm
            item={view.data}
            id={id}
            idArg={editing ? idArg : ""}
            tool={editing ? editTool : addTool}
            permission={permission}
            fields={typeof fields === "function" ? fields(view.data) : fields}
            keep={keep}
            build={editing ? editBuild?.(view.data) : addBuild}
            check={check}
            visible={visible}
            sendVersion={sendVersion}
            bare
            openCount={1}
            onSaved={leave}
            onCancel={leave}
          />
        </div>
      ) : null}
    </Shell>
  );
}
