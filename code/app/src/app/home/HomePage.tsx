import { useNavigate } from "react-router-dom";
import type { AgencyKind } from "./cards";
import type { AgencyView } from "../../features/agency/modules";
import { StartRows } from "./StartRows";
import { doSomethingPath } from "../routes";
import { homeTab } from "../tabs";
import { homePath } from "./homePaths";
import { Ongoing } from "../../features/started/Ongoing";
import { LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../Shell";

export type DoSomethingSegment = "start" | "ongoing";

type Props = { kind?: AgencyKind; view?: AgencyView | null; segment?: DoSomethingSegment };

export function HomePage({ kind, view, segment = "start" }: Props) {
  const navigate = useNavigate();
  return (
    <Shell title={segment === "start" ? "Start a task" : "Your tasks"} onBack={() => navigate(homePath())} backLabel={homeTab.label}>
      {segment === "start" ? (
        <>
          <StartRows kind={kind} view={view} />
          {kind ? null : <LoadingLine words="Loading your agency…" />}
        </>
      ) : (
        <Ongoing onStart={() => navigate(doSomethingPath())} />
      )}
    </Shell>
  );
}
