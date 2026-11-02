import { useLocation, useNavigate } from "react-router-dom";
import { openAgencyId } from "../../agency/open";
import { useLoad } from "../../forms/useLoad";
import { mcpStartedClient, startedAnswerOf, type StartedAnswer, type StartedClient } from "../../started/api";
import { Button } from "../../ui/Button";
import { ListRow, Rows } from "../../ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../ui/LoadState";

const memberUnknownLine = "The app could not tell who you are, so some rows may be missing.";

const sourceFailedLine = "Some of your ongoing apps could not be loaded.";

const missingRowsLine = (failed: StartedAnswer["failed"]) => {
  if (failed.length === 0) return "";
  return failed.includes("member") ? memberUnknownLine : sourceFailedLine;
};

export function Ongoing({ client = mcpStartedClient, onStart }: { client?: StartedClient; onStart: () => void }) {
  const navigate = useNavigate();
  const backTo = useLocation().pathname;
  const ongoing = useLoad(() => startedAnswerOf(client), `started:${openAgencyId()}`);
  if (ongoing.state === "error") return <LoadFailed words="Your ongoing apps could not be loaded." />;
  if (ongoing.state === "loading") return <LoadingLine />;
  const { items, failed } = ongoing.data;
  const missing = missingRowsLine(failed);
  if (items.length === 0 && missing) return <LoadFailed words={missing} />;
  if (items.length === 0) {
    return (
      <EmptyCard words="Nothing ongoing yet">
        <Button kind="primary" onClick={onStart}>
          Go to Start
        </Button>
      </EmptyCard>
    );
  }
  return (
    <>
      <Rows>
        {items.map((item) => (
          <ListRow
            key={item.id}
            title={item.title || item.workflow}
            meta={[item.title ? item.workflow : "", item.state].filter(Boolean).join(" · ")}
            end="›"
            onClick={() => navigate(item.path, { state: { backTo } })}
          />
        ))}
      </Rows>
      {missing ? <p role="alert">{missing}</p> : null}
    </>
  );
}
