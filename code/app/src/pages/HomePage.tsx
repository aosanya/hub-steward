import { useState } from "react";
import type { AgencyKind } from "../home/cards";
import type { AgencyView } from "../agency/modules";
import { StartRows } from "../home/StartRows";
import { Ongoing } from "./started/Ongoing";
import { Segmented, type SegmentedItem } from "../ui/Segmented";
import { LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";

type Segment = "start" | "ongoing";

const segments: SegmentedItem<Segment>[] = [
  { id: "start", label: "Start" },
  { id: "ongoing", label: "Ongoing" },
];

export function HomePage({ kind, view }: { kind?: AgencyKind; view?: AgencyView | null }) {
  const [segment, setSegment] = useState<Segment>("start");
  return (
    <Shell title="Do Something" sub={view?.name || undefined}>
      <Segmented items={segments} current={segment} onChange={setSegment} />
      {segment === "start" ? (
        <>
          <StartRows kind={kind} view={view} />
          {kind ? null : <LoadingLine words="Loading your agency…" />}
        </>
      ) : (
        <Ongoing onStart={() => setSegment("start")} />
      )}
    </Shell>
  );
}
