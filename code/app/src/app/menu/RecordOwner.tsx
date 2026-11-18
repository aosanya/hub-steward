import { useNavigate } from "react-router-dom";
import { useLoad } from "../../features/forms/useLoad";
import { ListRow } from "../../shared/ui/ListRow";
import { Section } from "../../shared/ui/Section";
import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { personNameOf } from "./sections/residents/personName";
import { residentPaths } from "./sections/residents/paths";

type Item = Record<string, unknown>;

const loadOwnerName = (ownerId: string) => async () => {
  const reply = (await callTool("", "actor_get_actor", { actor_id: ownerId })) as { item?: Item } | Item | null;
  const person = (reply as { item?: Item } | null)?.item ?? reply;
  return person && typeof person === "object" ? personNameOf(person as Item) : "";
};

function OwnerRow({ heading, ownerId, name }: { heading: string; ownerId: string; name: string }) {
  const navigate = useNavigate();
  return <Section icon="users" word={heading} rows={[<ListRow key={ownerId} title={name} meta="Resident" end="›" onClick={() => navigate(residentPaths.people.path({ person: ownerId }))} />]} />;
}

function OwnerName({ heading, ownerId }: { heading: string; ownerId: string }) {
  const view = useLoad(loadOwnerName(ownerId), `record-owner:${openAgencyId()}:${ownerId}`);
  if (view.state !== "ready" || view.data === "") return null;
  return <OwnerRow heading={heading} ownerId={ownerId} name={view.data} />;
}

export function RecordOwner({ heading, ownerId, name }: { heading: string; ownerId: string; name?: string }) {
  if (!ownerId) return null;
  return name ? <OwnerRow heading={heading} ownerId={ownerId} name={name} /> : <OwnerName heading={heading} ownerId={ownerId} />;
}
