import { useNavigate } from "react-router-dom";
import { ListRow } from "../../ui/ListRow";
import { mcpStartClient, startPath, type StartClient } from "./api";
import { useStartWaiting } from "./startWaiting";

export function StartInboxRows({ client = mcpStartClient }: { client?: StartClient }) {
  const navigate = useNavigate();
  const steps = useStartWaiting(client) ?? [];
  return (
    <>
      {steps.map((s) => (
        <ListRow
          key={s.id}
          title={s.title}
          meta={[s.agencyName, s.roleName].filter(Boolean).join(" · ")}
          start={<span className="dot" role="img" aria-label="Unread" />}
          onClick={() => navigate(startPath(s.id))}
        />
      ))}
    </>
  );
}
