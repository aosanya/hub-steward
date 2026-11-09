import type { ReactNode } from "react";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { EmptyCard, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { askMayRead, noRoleWords } from "./access";

type Props = { ask?: () => Promise<boolean>; children: ReactNode };

export function NeedsRole({ ask = askMayRead, children }: Props) {
  const may = useLoad(ask, `may-read-backlogs:${openAgencyId()}`);
  if (may.state === "loading") {
    return (
      <Shell title="Backlogs">
        <LoadingLine />
      </Shell>
    );
  }
  if (may.state === "ready" && !may.data) {
    return (
      <Shell title="Backlogs">
        <EmptyCard words={noRoleWords} />
      </Shell>
    );
  }
  return <>{children}</>;
}
