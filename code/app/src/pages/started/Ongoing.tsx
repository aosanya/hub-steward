import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { openAgencyId } from "../../agency/open";
import { useLoad } from "../../forms/useLoad";
import { mcpStartedClient, startedAnswerOf, type StartedAnswer, type StartedClient, type StartedItem, type WaitsOn } from "../../started/api";
import { Button } from "../../ui/Button";
import { ListRow, Rows } from "../../ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../ui/LoadState";
import { SectionHeading } from "../../ui/SectionHeading";
import { Segmented, type SegmentedItem } from "../../ui/Segmented";

type OngoingTab = "live";

const ongoingTabs: SegmentedItem<OngoingTab>[] = [{ id: "live", label: "Live" }];

const sections: { waitsOn: WaitsOn; heading: string }[] = [
  { waitsOn: "you", heading: "Needs you" },
  { waitsOn: "others", heading: "With others" },
];

const memberUnknownLine = "The app could not tell who you are, so some rows may be missing.";

const sourceFailedLine = "Some of your tasks could not be loaded.";

const missingRowsLine = (failed: StartedAnswer["failed"]) => {
  if (failed.length === 0) return "";
  return failed.includes("member") ? memberUnknownLine : sourceFailedLine;
};

function LiveTab({ items }: { items: StartedItem[] }) {
  const navigate = useNavigate();
  const backTo = useLocation().pathname;
  return (
    <>
      {sections.map(({ waitsOn, heading }) => {
        const rows = items.filter((item) => item.waitsOn === waitsOn);
        if (rows.length === 0) return null;
        return (
          <section key={waitsOn}>
            <SectionHeading>{heading}</SectionHeading>
            <Rows>
              {rows.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.title || item.workflow}
                  meta={[[item.title ? item.workflow : "", item.state].filter(Boolean).join(" · "), item.reason]}
                  end="›"
                  onClick={() => navigate(item.path, { state: { backTo } })}
                />
              ))}
            </Rows>
          </section>
        );
      })}
    </>
  );
}

export function Ongoing({ client = mcpStartedClient, onStart }: { client?: StartedClient; onStart: () => void }) {
  const [tab, setTab] = useState<OngoingTab>("live");
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt(attempt + 1);
  const ongoing = useLoad(() => startedAnswerOf(client), `started:${openAgencyId()}:${attempt}`);
  if (ongoing.state === "error") return <LoadFailed words="Your tasks could not be loaded." onRetry={retry} />;
  if (ongoing.state === "loading") return <LoadingLine />;
  const { items, failed } = ongoing.data;
  const missing = missingRowsLine(failed);
  if (items.length === 0 && missing) return <LoadFailed words={missing} onRetry={retry} />;
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
      {ongoingTabs.length > 1 ? <Segmented items={ongoingTabs} current={tab} onChange={setTab} label="Ongoing" /> : null}
      {tab === "live" ? <LiveTab items={items} /> : null}
      {missing ? <LoadFailed words={missing} onRetry={retry} /> : null}
    </>
  );
}
