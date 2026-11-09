import { useNavigate } from "react-router-dom";
import type { AgencyKind } from "../home/cards";
import type { AgencyView } from "../agency/modules";
import { StartRows } from "../home/StartRows";
import { doSomethingPath } from "../routes";
import { Ongoing } from "./started/Ongoing";
import { LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";

export type DoSomethingSegment = "start" | "ongoing";

type Props = { kind?: AgencyKind; view?: AgencyView | null; segment?: DoSomethingSegment };

export function HomePage({ kind, view, segment = "start" }: Props) {
  const navigate = useNavigate();
  return (
    <Shell title="Do Something" sub={view?.name || undefined}>
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
