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

function OwnerName({ heading, ownerId }: { heading: string; ownerId: string }) {
  const navigate = useNavigate();
  const view = useLoad(loadOwnerName(ownerId), `record-owner:${openAgencyId()}:${ownerId}`);
  if (view.state !== "ready" || view.data === "") return null;
  return <Section icon="users" word={heading} rows={[<ListRow key={ownerId} title={view.data} meta="Resident" end="›" onClick={() => navigate(residentPaths.people.path({ person: ownerId }))} />]} />;
}

export function RecordOwner({ heading, ownerId }: { heading: string; ownerId: string }) {
  return ownerId ? <OwnerName heading={heading} ownerId={ownerId} /> : null;
}
