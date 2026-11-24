import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Shell } from "../../app/Shell";
import { useLanguage } from "../../shared/language/language";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { assumedGroupNow } from "../../shared/wakala/assumedGroup";
import { assumedGroupsClient, type MyGroupsReading, type SeatedGroup } from "./assumedApi";
import { GroupList } from "./GroupList";
import { holdGroup, keepGroup } from "./keepGroup";
import { NoGroupPage } from "./NoGroupPage";

type View = { name: "checking" } | { name: "through" } | { name: "none" } | { name: "choose"; groups: SeatedGroup[]; refused: boolean };

const through: View = { name: "through" };

const settle = async (agencyId: string, { groups, assumedId }: MyGroupsReading): Promise<View> => {
  if (groups.length === 0) return { name: "none" };
  const already = groups.find((group) => group.id === assumedId);
  const only = groups.length === 1 ? groups[0] : undefined;
  const chosen = already ?? only;
  if (!chosen) return { name: "choose", groups, refused: false };
  if (already) {
    holdGroup(agencyId, already, groups.length);
    return through;
  }
  try {
    await keepGroup(agencyId, chosen, groups.length);
    return through;
  } catch {
    return { name: "choose", groups, refused: true };
  }
};

function Gate({ agencyId, children }: { agencyId: string; children: ReactNode }) {
  const { words } = useLanguage();
  const [view, setView] = useState<View>(assumedGroupNow()?.agencyId === agencyId ? through : { name: "checking" });

  useEffect(() => {
    if (view.name !== "checking") return;
    let live = true;
    assumedGroupsClient()
      .read(agencyId)
      .then(
        (reading) => settle(agencyId, reading),
        () => through,
      )
      .then((next) => live && setView(next));
    return () => {
      live = false;
    };
  }, [view.name, agencyId]);

  if (view.name === "through") return <>{children}</>;
  if (view.name === "none") return <NoGroupPage onCheckAgain={() => setView({ name: "checking" })} />;
  if (view.name === "checking") {
    return (
      <Shell tabless title={words.groupChooseTitle}>
        <LoadingLine />
      </Shell>
    );
  }
  const { groups, refused } = view;
  const pick = async (group: SeatedGroup) => {
    try {
      await keepGroup(agencyId, group, groups.length);
      setView(through);
    } catch {
      setView({ name: "choose", groups, refused: true });
    }
  };
  return (
    <Shell tabless title={words.groupChooseTitle}>
      {refused ? <LoadFailed words={words.groupNotChanged} /> : null}
      <GroupList groups={groups} onPick={pick} />
    </Shell>
  );
}

export function GroupGate({ children }: { children: ReactNode }) {
  const { agencyId = "" } = useParams();
  return (
    <Gate key={agencyId} agencyId={agencyId}>
      {children}
    </Gate>
  );
}
