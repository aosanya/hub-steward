import { useNavigate } from "react-router-dom";
import { waitingStepsOf } from "../../inbox/needsYou";
import { ListRow } from "../../ui/ListRow";
import { mcpStartClient, startPath, type StartClient } from "./api";
import { useStartWaiting } from "./startWaiting";

export function StartWaitingRows({ client = mcpStartClient }: { client?: StartClient }) {
  const navigate = useNavigate();
  const steps = waitingStepsOf(useStartWaiting(client) ?? []);
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
