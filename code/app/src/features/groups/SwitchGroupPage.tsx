import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shell } from "../../app/Shell";
import { useBackOrHome } from "../../app/useBackOrHome";
import { useLanguage } from "../../shared/language/language";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { useLoad } from "../forms/useLoad";
import { assumedGroupsClient, type SeatedGroup } from "./assumedApi";
import { GroupList } from "./GroupList";
import { keepGroup } from "./keepGroup";

const currentFirst = (groups: SeatedGroup[], currentId: string) => [...groups.filter((group) => group.id === currentId), ...groups.filter((group) => group.id !== currentId)];

export function SwitchGroupPage() {
  const { words } = useLanguage();
  const { agencyId = "" } = useParams();
  const back = useBackOrHome();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [refused, setRefused] = useState(false);
  const loaded = useLoad(() => assumedGroupsClient().read(agencyId), `my-groups:${agencyId}:${attempt}`);

  const pick = async (group: SeatedGroup, count: number, currentId: string) => {
    if (group.id === currentId) return back();
    try {
      await keepGroup(agencyId, group, count);
      navigate(-1);
    } catch {
      setRefused(true);
    }
  };

  return (
    <Shell tabless title={words.groupSwitch} backLabel={words.tabHome} onBack={back}>
      {loaded.state === "loading" ? <LoadingLine /> : null}
      {loaded.state === "error" ? <LoadFailed words={words.groupsUnreached} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {refused ? <LoadFailed words={words.groupNotChanged} /> : null}
      {loaded.state === "ready" ? (
        <GroupList
          groups={currentFirst(loaded.data.groups, loaded.data.assumedId)}
          currentId={loaded.data.assumedId}
          onPick={(group) => pick(group, loaded.data.groups.length, loaded.data.assumedId)}
        />
      ) : null}
    </Shell>
  );
}
