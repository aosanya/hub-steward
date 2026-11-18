import { useNavigate } from "react-router-dom";
import { useMayAnswer } from "../../features/agency/useMay";
import { LoadFailed } from "../../shared/ui/LoadState";
import { Shell } from "../Shell";
import { MenuEditForm, type EditField } from "./MenuEditForm";

type Props = {
  title: string;
  backLabel: string;
  backTo: string;
  permission: string;
  tool: string;
  fields: EditField[];
  build: (sent: Record<string, unknown>) => Record<string, unknown>;
  check?: (values: Record<string, string>) => string;
  visible?: (key: string, values: Record<string, string>) => boolean;
};

export function AddScreen({ title, backLabel, backTo, permission, tool, fields, build, check, visible }: Props) {
  const navigate = useNavigate();
  const { known, may } = useMayAnswer(permission);
  const leave = () => navigate(backTo);
  return (
    <Shell title={title} titleUnder backLabel={backLabel} onBack={leave} tabless>
      {known && !may ? <LoadFailed words="You may not add this." /> : null}
      {known && may ? (
        <div className="person-page">
          <MenuEditForm item={{}} id="" idArg="" tool={tool} permission={permission} fields={fields} build={build} check={check} visible={visible} bare openCount={1} onSaved={leave} onCancel={leave} />
        </div>
      ) : null}
    </Shell>
  );
}
