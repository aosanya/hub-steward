import { useNavigate, useParams } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { SeatLimits, seatsOf } from "./ApprovalLimitEdit";
import { RolePermissions } from "./RolePermissions";
import { loadRole } from "./roleData";
import { staffPaths } from "./paths";
import { text, type Item } from "./staffData";

function RoleEditScreen({ title, permission, form }: { title: string; permission: string; form: (role: Item, done: () => void) => JSX.Element | null }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const may = useMay(permission);
  const view = useLoad(() => loadRole(id), `role-edit:${openAgencyId()}:${id}:${title}`);
  const back = () => navigate(staffPaths.roles.path({ role: id }));
  const name = view.state === "ready" ? text(view.data, "name") : "";
  return (
    <Shell title={title} titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" && may ? <div className="person-page">{form(view.data, back)}</div> : null}
    </Shell>
  );
}

export const RoleLimitsEditScreen = () => (
  <RoleEditScreen title="Edit approval limits" permission="role.assign" form={(role, done) => <SeatLimits seats={seatsOf(role)} onSaved={done} />} />
);

export const RolePermissionsEditScreen = () => (
  <RoleEditScreen title="Edit permissions" permission="permission.override" form={(role, done) => <RolePermissions role={role} onSaved={done} />} />
);
