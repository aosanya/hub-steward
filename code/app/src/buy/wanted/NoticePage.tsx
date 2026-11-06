import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { mcpWantedClient, type WantedClient } from "./api";
import { dayWords } from "../../ui/days";
import { buyInputs } from "./buyInputs";
import "./notice.css";

export function NoticePage({ client = mcpWantedClient }: { client?: WantedClient }) {
  const { noticeId = "" } = useParams();
  const navigate = useNavigate();
  const notice = useLoad(async () => (await client.listNotices()).find((n) => n.id === noticeId) ?? null, noticeId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const takeDown = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await client.withdrawNotice(noticeId);
      navigate(buyInputs);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Shell title="Your notice" onBack={() => navigate(buyInputs)}>
      {notice.state === "error" || (notice.state === "ready" && notice.data === null) ? <LoadFailed words="The notice could not be found." /> : null}
      {notice.state === "ready" && notice.data ? (
        <>
          <Rows>
            <ListRow title="What" end={notice.data.what} />
            {notice.data.quantity ? <ListRow title="How much" end={notice.data.quantity} /> : null}
            {notice.data.neededBy ? <ListRow title="Needed by" end={dayWords(notice.data.neededBy)} /> : null}
            <ListRow title="Seen by" end="Every shop" />
          </Rows>
          <Button className="danger" disabled={busy} onClick={takeDown}>
            Take it down
          </Button>
          {failed ? <p role="alert">The notice is still up. Try again.</p> : null}
        </>
      ) : null}
    </Shell>
  );
}
