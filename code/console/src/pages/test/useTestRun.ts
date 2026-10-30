import { useCallback, useEffect, useState } from "react";
import {
  isActive,
  loadTestRun,
  runPollMs,
  type RunPage,
} from "../../data/testRun";
import { useReportLoading } from "../../shell/loadingContext";
import type { Loaded } from "../../shell/useLoaded";

export function useTestRun(
  hubId: string,
  runId: string,
): { state: Loaded<RunPage>; reload: () => void } {
  const [state, setState] = useState<Loaded<RunPage>>({ kind: "loading" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    let shown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () =>
      loadTestRun(hubId, runId).then(
        (value) => {
          if (!current) return;
          shown = true;
          setState({ kind: "ready", value });
          if (isActive(value.run.result)) timer = setTimeout(read, runPollMs);
        },
        () => {
          if (!current) return;
          if (shown) timer = setTimeout(read, runPollMs);
          else setState({ kind: "failed" });
        },
      );
    read();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [hubId, runId, round]);

  useReportLoading(state.kind === "loading");

  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { state, reload };
}
