import { useLoad } from "../../features/forms/useLoad";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { SectionHeading } from "../../shared/ui/SectionHeading";
import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { personNameOf } from "./sections/residents/personName";

type Item = Record<string, unknown>;

const loadOwnerName = (ownerId: string) => async () => {
  const reply = (await callTool("", "actor_get_actor", { actor_id: ownerId })) as { item?: Item } | Item | null;
  const person = (reply as { item?: Item } | null)?.item ?? reply;
  return person && typeof person === "object" ? personNameOf(person as Item) : "";
};

function OwnerName({ heading, ownerId }: { heading: string; ownerId: string }) {
  const view = useLoad(loadOwnerName(ownerId), `record-owner:${openAgencyId()}:${ownerId}`);
  if (view.state !== "ready" || view.data === "") return null;
  return (
    <>
      <SectionHeading>{heading}</SectionHeading>
      <Rows>
        <ListRow title={view.data} />
      </Rows>
    </>
  );
}

export function RecordOwner({ heading, ownerId }: { heading: string; ownerId: string }) {
  return ownerId ? <OwnerName heading={heading} ownerId={ownerId} /> : null;
}
