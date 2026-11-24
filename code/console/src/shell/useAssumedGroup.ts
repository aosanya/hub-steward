import { useCallback, useEffect, useState } from "react";
import { assumeGroup, listMyGroups, type MyGroup } from "../data/groups";

export type AssumedGroup =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "none" }
  | { status: "pick"; groups: MyGroup[] }
  | { status: "ready"; groups: MyGroup[]; assumed: MyGroup };

export type GroupSession = {
  state: AssumedGroup;
  assume: (group: MyGroup) => Promise<boolean>;
  reload: () => void;
};

const resolved = async (hubId: string): Promise<AssumedGroup> => {
  const { groups, assumedId } = await listMyGroups(hubId);
  if (groups.length === 0) return { status: "none" };
  const held = groups.find((group) => group.id === assumedId);
  if (held) return { status: "ready", groups, assumed: held };
  if (groups.length > 1) return { status: "pick", groups };
  await assumeGroup(hubId, groups[0].id);
  return { status: "ready", groups, assumed: groups[0] };
};

export function useAssumedGroup(hubId: string): GroupSession {
  const [state, setState] = useState<AssumedGroup>({ status: "loading" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    resolved(hubId).then(
      (next) => current && setState(next),
      () => current && setState({ status: "failed" }),
    );
    return () => {
      current = false;
    };
  }, [hubId, round]);

  const assume = useCallback(
    async (group: MyGroup) => {
      try {
        await assumeGroup(hubId, group.id);
      } catch {
        return false;
      }
      setState((prev) => (prev.status === "pick" || prev.status === "ready" ? { status: "ready", groups: prev.groups, assumed: group } : prev));
      return true;
    },
    [hubId],
  );
  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { state, assume, reload };
}
