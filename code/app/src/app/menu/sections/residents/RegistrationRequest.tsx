import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";

type Item = Record<string, unknown>;

const decidePermission = "join_request.decide";

const words = (item: Item, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

type Props = { request: Item; onAnswered: () => void };

export function RegistrationRequest({ request, onAnswered }: Props) {
  const may = useMay(decidePermission);
  const [busy, setBusy] = useState(false);
  const requestId = words(request, "request_id");
  if (requestId === "") return null;
  const answer = (tool: string) => async () => {
    setBusy(true);
    try {
      await callTool("", tool, { request_id: requestId });
      onAnswered();
    } finally {
      setBusy(false);
    }
  };
  const acts = may ? (
    <>
      <button type="button" className="sec-act" disabled={busy} onClick={answer("actor_approve_join_request")}>Approve</button>
      <button type="button" className="sec-act" disabled={busy} onClick={answer("actor_decline_join_request")}>Decline</button>
    </>
  ) : undefined;
  return (
    <Section
      word="Request"
      plain
      foot={acts}
      rows={[
        <ListRow key="group" title="Group asked for" meta={words(request, "group_name")} />,
        <ListRow key="asked" title="Asked on" meta={words(request, "asked")} />,
      ]}
    />
  );
}
