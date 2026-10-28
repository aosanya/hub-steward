import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadDraft,
  publishDraft,
  showsDraftBar,
  type DraftChange,
  type DraftProblem,
  type DraftSnapshot,
  type DraftState,
  type Published,
} from "../data/draft";

export type DraftApi = {
  state: DraftState;
  ready: boolean;
  changes: DraftChange[];
  problems: DraftProblem[];
  version: Published | null;
  publish: () => void;
};

type Run =
  | { hubId: string; phase: "publishing" }
  | { hubId: string; phase: "failed"; problems: DraftProblem[] }
  | { hubId: string; phase: "published"; version: Published };

const noChanges: DraftChange[] = [];

const noProblems: DraftProblem[] = [];

export function useDraft(hubId: string, page: string, refresh: number): DraftApi {
  const active = showsDraftBar(page);
  const [loaded, setLoaded] = useState<{ hubId: string; snapshot: DraftSnapshot } | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [round, setRound] = useState(0);
  const publishing = useRef(false);

  useEffect(() => {
    if (!active) return;
    let current = true;
    loadDraft(hubId).then(
      (snapshot) => {
        if (current) setLoaded({ hubId, snapshot });
      },
      () => {
        if (current) setLoaded(null);
      },
    );
    return () => {
      current = false;
    };
  }, [hubId, active, page, refresh, round]);

  const snapshot = loaded !== null && loaded.hubId === hubId ? loaded.snapshot : null;
  const draftId = snapshot?.draft?.id ?? "";
  const mine = run !== null && run.hubId === hubId ? run : null;

  const publish = useCallback(() => {
    if (draftId === "" || publishing.current) return;
    publishing.current = true;
    setRun({ hubId, phase: "publishing" });
    publishDraft(hubId, draftId).then((outcome) => {
      publishing.current = false;
      if ("published" in outcome) {
        const { published } = outcome;
        setLoaded((before) =>
          before === null ? before : { hubId, snapshot: { ...before.snapshot, changes: noChanges, last: published } },
        );
        setRun({ hubId, phase: "published", version: published });
      } else {
        setRun({ hubId, phase: "failed", problems: outcome.problems });
      }
      setRound((n) => n + 1);
    });
  }, [hubId, draftId]);

  return useMemo<DraftApi>(() => {
    const changes = snapshot?.changes ?? noChanges;
    const version = mine?.phase === "published" ? mine.version : null;
    const problems = mine?.phase === "failed" ? mine.problems : noProblems;
    const state: DraftState =
      mine?.phase === "publishing"
        ? "publishing"
        : mine?.phase === "failed"
          ? "failed"
          : changes.length > 0
            ? "pending"
            : version !== null
              ? "published"
              : "none";
    return { state, ready: snapshot !== null, changes, problems, version, publish };
  }, [snapshot, mine, publish]);
}
