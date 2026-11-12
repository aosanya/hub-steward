import { useNavigate } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { type InboxClient, mcpInboxClient } from "../inbox/api";
import { thingsToDoLabel } from "../inbox/thingsToDo";
import { useNeedsYou } from "../inbox/useNeedsYou";
import { needsYouPath } from "../tabs";
import { ListRow, Rows } from "../ui/ListRow";

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
