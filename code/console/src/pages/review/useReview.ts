import { useCallback, useEffect, useRef, useState } from "react";
import { workingDraftId } from "../../data/draft";
import { getReview, reviewPollMs, startReview, type AreaName, type Finding, type ReviewPage } from "../../data/reviewApi";

export type ReviewState = "loading" | "ready" | "failed";

const notLoaded = "The review could not be loaded.";
const notStarted = "The review could not be started.";

const sentenceOf = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message !== "" ? error.message : fallback;

const runningIdOf = (page: ReviewPage | null): string =>
  page !== null && page.review.status === "running" ? page.review.id : "";

export function useReview(hubId: string, area?: AreaName): {
  page: ReviewPage | null;
  state: ReviewState;
  error: string;
  starting: boolean;
  start: () => Promise<void>;
  replaceFinding: (finding: Finding) => void;
} {
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [state, setState] = useState<ReviewState>("loading");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setState("loading");
    setError("");
    setPage(null);
    workingDraftId(hubId)
      .then((draftId) => (draftId === "" ? null : getReview(hubId, { draftId })))
      .then(
        (found) => {
          if (!current) return;
          setPage(found);
          setState("ready");
        },
        (failure) => {
          if (!current) return;
          setError(sentenceOf(failure, notLoaded));
          setState("failed");
        },
      );
    return () => {
      current = false;
    };
  }, [hubId]);

  const watching = runningIdOf(page);
  const watchedDraft = page === null ? "" : page.review.draft_id;

  useEffect(() => {
    if (watching === "") return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      timer = setTimeout(() => {
        getReview(hubId, { draftId: watchedDraft }).then(
          (next) => {
            if (!current) return;
            if (next !== null) setPage(next);
            later();
          },
          () => {
            if (current) later();
          },
        );
      }, reviewPollMs);
    };
    later();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [hubId, watching, watchedDraft]);

  const start = useCallback(async () => {
    setStarting(true);
    setError("");
    try {
      const started = await startReview(hubId, await workingDraftId(hubId), area);
      if (!mounted.current) return;
      setPage(started);
      setState("ready");
    } catch (failure) {
      if (mounted.current) setError(sentenceOf(failure, notStarted));
    } finally {
      if (mounted.current) setStarting(false);
    }
  }, [hubId, area]);

  const replaceFinding = useCallback((finding: Finding) => {
    setPage((held) =>
      held === null
        ? held
        : {
            ...held,
            areas: held.areas.map((area) => ({
              ...area,
              findings: area.findings.map((each) => (each.id === finding.id ? finding : each)),
            })),
          },
    );
  }, []);

  return { page, state, error, starting, start, replaceFinding };
}
