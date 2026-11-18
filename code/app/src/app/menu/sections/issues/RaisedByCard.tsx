import { useNavigate } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { residentPaths } from "../residents/paths";
import { loadPerson } from "../residents/PersonScreen";

type Item = Record<string, unknown>;

const residentRead = "resident.read";

const unnamed = "Unnamed person";

const anonymousWords = "Anonymous";

const textOf = (item: Item, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

function ResidentRow({ id }: { id: string }) {
  const navigate = useNavigate();
  const view = useLoad(async () => String((await loadPerson(id)).display_name ?? ""), `issue-raised-by:${openAgencyId()}:${id}`);
  if (view.state !== "ready") return null;
  const row = <ListRow key={id} title={view.data || unnamed} meta="Resident" end="›" onClick={() => navigate(residentPaths.people.path({ person: id }))} />;
  return <Section icon="users" word="Raised by" rows={[row]} />;
}

export function RaisedByCard({ item }: { item: Item }) {
  const may = useMay(residentRead);
  const id = textOf(item, "raised_by");
  if (item.anonymous === true) return <Section icon="users" word="Raised by" rows={[<ListRow key="anonymous" title={anonymousWords} />]} />;
  return may && id ? <ResidentRow id={id} /> : null;
}
