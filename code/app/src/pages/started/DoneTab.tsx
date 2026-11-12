import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { openAgencyId } from "../../agency/open";
import { useLoad } from "../../forms/useLoad";
import { doneSources, newestFirst, type DoneClient, type DoneItem, type DonePage } from "../../started/done";
import { Button } from "../../ui/Button";
import { shortDayWords } from "../../ui/days";
import { ListRow, Rows } from "../../ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../ui/LoadState";

const allFailedWords = "Your finished tasks could not be loaded.";

const someFailedWords = "Some of your finished tasks could not be loaded.";

const nothingFinishedWords = "Nothing finished yet";

const showMoreWords = "Show more";

const dayLine = (item: DoneItem) => shortDayWords(item.endedAt) ?? "";

function DoneRows({ items }: { items: DoneItem[] }) {
  const navigate = useNavigate();
  const backTo = useLocation().pathname;
  return (
    <Rows>
      {items.map((item) => (
        <ListRow
          key={item.id}
          title={item.title || item.workflow}
          meta={[[item.workflow, item.state].filter(Boolean).join(" · "), dayLine(item)]}
          end={item.path ? "›" : undefined}
          onClick={item.path ? () => navigate(item.path, { state: { backTo } }) : undefined}
        />
      ))}
    </Rows>
  );
}

function DonePages({ first, client }: { first: DonePage; client: DoneClient }) {
  const [page, setPage] = useState(first);
  const [reading, setReading] = useState(false);
  const readOn = async () => {
    setReading(true);
    const asked = doneSources.filter((source) => page.next?.[source] != null);
    const fresh: DonePage = await client.read(page.next).catch(() => ({ items: [], failed: asked, next: page.next }));
    setPage({ items: newestFirst([...page.items, ...fresh.items]), failed: fresh.failed, next: fresh.next });
    setReading(false);
  };
  const { items, failed, next } = page;
  if (items.length === 0 && failed.length > 0) return <LoadFailed words={someFailedWords} onRetry={readOn} />;
  if (items.length === 0 && next === null) return <EmptyCard words={nothingFinishedWords} />;
  return (
    <>
      <DoneRows items={items} />
      {failed.length > 0 ? <LoadFailed words={someFailedWords} onRetry={readOn} /> : null}
      {failed.length === 0 && next !== null ? (
        <Button onClick={readOn} disabled={reading}>
          {showMoreWords}
        </Button>
      ) : null}
    </>
  );
}

export function DoneTab({ client }: { client: DoneClient }) {
  const [attempt, setAttempt] = useState(0);
  const finished = useLoad(() => client.read(null), `done:${openAgencyId()}:${attempt}`);
  if (finished.state === "error") return <LoadFailed words={allFailedWords} onRetry={() => setAttempt(attempt + 1)} />;
  if (finished.state === "loading") return <LoadingLine />;
  return <DonePages first={finished.data} client={client} />;
}
