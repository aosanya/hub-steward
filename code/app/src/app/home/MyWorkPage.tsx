import { useNavigate } from "react-router-dom";
import type { AgencyKind } from "./cards";
import type { AgencyView } from "../../features/agency/modules";
import { useLanguage } from "../../shared/language/language";
import { StartRows } from "./StartRows";
import { ToDoRows } from "./ToDoRows";
import { Ongoing } from "../../features/started/Ongoing";
import { LoadingLine } from "../../shared/ui/LoadState";
import { Segmented, type SegmentedItem } from "../../shared/ui/Segmented";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { Shell } from "../Shell";
import { myWorkTab, ongoingTab, startTab, tabPathIn, type Tab } from "../tabs";

export type MyWorkSegment = "todo" | "ongoing" | "start";

type Props = { kind?: AgencyKind; view?: AgencyView | null; segment?: MyWorkSegment };

const tabOf: Record<MyWorkSegment, Tab> = { todo: myWorkTab, ongoing: ongoingTab, start: startTab };

export function MyWorkPage({ kind, view, segment = "start" }: Props) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const items: SegmentedItem<MyWorkSegment>[] = [
    { id: "todo", label: words.myWorkToDo },
    { id: "ongoing", label: words.myWorkOngoing },
    { id: "start", label: words.myWorkStart },
  ];
  return (
    <Shell title={myWorkTab.label}>
      <Segmented items={items} current={segment} onChange={(next) => navigate(tabPathIn(tabOf[next], openAgencyId()), { replace: true })} label={myWorkTab.label} />
      {segment === "todo" ? <ToDoRows /> : null}
      {segment === "start" ? (
        <>
          <StartRows kind={kind} view={view} />
          {kind ? null : <LoadingLine words="Loading your agency…" />}
        </>
      ) : null}
      {segment === "ongoing" ? <Ongoing onStart={() => navigate(tabPathIn(startTab, openAgencyId()))} /> : null}
    </Shell>
  );
}
