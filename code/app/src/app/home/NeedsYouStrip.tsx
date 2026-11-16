import { useNavigate } from "react-router-dom";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { mcpStartClient, type StartClient } from "../../features/market/start/api";
import { type InboxClient, mcpInboxClient } from "../../features/inbox/api";
import { thingsToDoLabel } from "../../features/inbox/thingsToDo";
import { useNeedsYou } from "../../features/inbox/useNeedsYou";
import { needsYouPath } from "../tabs";
import { ListRow, Rows } from "../../shared/ui/ListRow";

type RowProps = { count: number | null; to?: string };

export function NeedsYouStripRow({ count, to }: RowProps) {
  const navigate = useNavigate();
  const things = thingsToDoLabel(count);
  if (!things) return null;
  return (
    <Rows>
      <ListRow title={`You have ${things.words}`} end="›" onClick={() => navigate(to ?? needsYouPath(openAgencyId()))} />
    </Rows>
  );
}

export function NeedsYouStrip({ inbox = mcpInboxClient, start = mcpStartClient }: { inbox?: InboxClient; start?: StartClient }) {
  const { count } = useNeedsYou(inbox, start);
  return <NeedsYouStripRow count={count} />;
}
