import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { SectionGo } from "../residents/SectionAct";
import { useOwner } from "../settings/useOwner";
import { holderNames, seatsOf, type StandingSeat } from "./ApprovalLimitEdit";
import { offeredPermissions, heldCodes } from "./RolePermissions";
import { amountWords } from "./roleData";
import { staffPaths } from "./paths";
import { text, type Item } from "./staffData";

const notSetWords = "Not set";

function ApprovalLimitRows({ role, seats }: { role: Item; seats: StandingSeat[] }) {
  const names = useLoad(holderNames, `holder-names:${openAgencyId()}`);
  const known = names.state === "ready" ? names.data : new Map<string, string>();
  const row = (seat: StandingSeat) => (
    <ListRow key={seat.id} title={known.get(seat.actorId) || "Holder"} meta={seat.limit === null ? "No limit set" : amountWords(seat.limit)} status={seat.limit === null ? notSetWords : undefined} />
  );
  return <Section word="Approval limits" icon="wallet" rows={seats.map(row)} foot={<SectionGo permission="role.assign" act="Edit approval limits" to={staffPaths.roleLimits.path({ id: text(role, "id") })} />} />;
}

function ApprovalLimitsCard({ role }: { role: Item }) {
  const may = useMay("role.assign");
  const seats = seatsOf(role);
  return may && seats.length > 0 ? <ApprovalLimitRows role={role} seats={seats} /> : null;
}

function PermissionsCard({ role }: { role: Item }) {
  const catalogue = useLoad(offeredPermissions, `permission-catalogue:${openAgencyId()}`);
  if (catalogue.state !== "ready") return null;
  const held = heldCodes(role);
  const rows = catalogue.data.filter((permission) => held.includes(permission.code)).map((permission) => <ListRow key={permission.code} title={permission.name} status="On" />);
  return <Section word="Permissions" icon="gear" rows={rows} empty={{ words: "No permissions yet." }} foot={<SectionGo permission="permission.override" act="Edit permissions" to={staffPaths.rolePermissions.path({ id: text(role, "id") })} />} />;
}

export function RolePage({ role }: { role: Item }) {
  const owner = useOwner();
  return (
    <div className="person-page">
      <div className="title-block">
        <h1 className="person-name">{text(role, "name")}</h1>
        <p className="quiet-line">{`Role · ${text(role, "meta")}`}</p>
      </div>
      <div className="sections">
        <Section
          word="Role detail"
          plain
          rows={[
            <ListRow key="name" title="Name" meta={text(role, "name")} />,
            <ListRow key="holders" title="Holders" meta={text(role, "meta")} />,
            ...(text(role, "limit") ? [<ListRow key="limit" title="Approval limit" meta={text(role, "limit")} />] : []),
          ]}
        />
        <ApprovalLimitsCard role={role} />
        {owner ? <PermissionsCard role={role} /> : null}
      </div>
    </div>
  );
}
