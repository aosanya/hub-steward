import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { hubPath } from "../api";
import type { ChatAnswer, SlotAnswer } from "../data/chatAnswer";
import { formTarget } from "../data/chatFill";
import { kindOf } from "../data/hubKind";
import type { ChipWords } from "../data/menu";
import { loadReviewBadges } from "../data/reviewBadges";
import { useSession } from "../session";
import type { Hub } from "../types";
import { Loading, StatusLine } from "../ui";
import { useI18n } from "../i18n";
import { NoticeCtx } from "../ui/noticeContext";
import { AnswerSlot } from "./AnswerSlot";
import { loadReview, saveReview, type KeptReview } from "../data/reviewMemory";
import { ChatAskCtx, ChatFillCtx, ChatTellCtx, type Ask, type Told } from "./chatTell";
import { useAskQueue } from "./useAskQueue";
import { ChatColumn } from "./ChatColumn";
import { ChipWordsCtx } from "./chipWords";
import { ConsoleCtx, type ConsoleContext } from "./context";
import { DraftCtx } from "./draftContext";
import { DraftSlot } from "./DraftSlot";
import { FailureCtx } from "./failureContext";
import { LoadingCtx } from "./loadingContext";
import { Menu } from "./Menu";
import { noBadges, pageOf, sameBadges, type Badges } from "./page";
import { itemPageOf } from "./labels";
import { ReviewTabs } from "./ReviewTabs";
import { Strip } from "./Strip";
import { useTheme } from "./theme";
import { useDraft } from "./useDraft";
import { useHubModelState } from "./useHubModelState";
import { useNoticeState } from "./useNoticeState";
import "./shell.css";

type ShellProps = { hubs: Hub[]; hub: Hub };

const narrowWidth = 1000;

const countsEvery = 30000;

const startsCollapsed = () => window.innerWidth < narrowWidth;

const inReview = (page: string) =>
  page === "publish-review" || page.startsWith("review-");

function useCounts(hub: Hub, reviewing: boolean, refresh: number): Badges {
  const hubId = hub.id;
  const [loaded, setLoaded] = useState({ hubId, values: noBadges });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!reviewing) return;
    const again = setInterval(() => setTick((n) => n + 1), countsEvery);
    return () => clearInterval(again);
  }, [reviewing]);

  useEffect(() => {
    if (!reviewing) {
      setLoaded((prev) => (prev.values === noBadges ? prev : { hubId, values: noBadges }));
      return;
    }
    let current = true;
    loadReviewBadges(hubId)
      .catch(() => ({}))
      .then((values) => {
        if (current)
          setLoaded((prev) =>
            prev.hubId === hubId && sameBadges(prev.values, values)
              ? prev
              : { hubId, values },
          );
      });
    return () => {
      current = false;
    };
  }, [hubId, reviewing, refresh, tick]);

  return loaded.hubId === hubId ? loaded.values : noBadges;
}

function Shell({ hubs, hub }: ShellProps) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const page = pageOf(pathname);
  const hubId = hub.id;
  const [reported, setReported] = useState({ hubId, values: noBadges });
  const [menuRefresh, setMenuRefresh] = useState(0);
  const [pageRound, setPageRound] = useState(0);
  const [loading, setLoading] = useState(0);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const { t } = useI18n();
  const [rail, setRail] = useState(startsCollapsed);
  const [answered, setAnswered] = useState<{
    hubId: string;
    answer: SlotAnswer | null;
  }>({ hubId, answer: null });
  const [reviewed, setReviewed] = useState<KeptReview | null>(() =>
    loadReview(hubId),
  );
  const [told, setTold] = useState<Told | null>(null);
  const asks = useAskQueue(hubId);
  const [chipWords, setChipWords] = useState<ChipWords>({});
  const counted = useCounts(hub, inReview(page), menuRefresh);
  const draft = useDraft(hubId, page, menuRefresh);
  const notice = useNoticeState(hubId);
  useHubModelState(hub, page);

  const reportedBadges = reported.hubId === hubId ? reported.values : noBadges;
  const badges = useMemo(
    () => ({ ...counted, ...reportedBadges }),
    [counted, reportedBadges],
  );
  const setBadges = useCallback(
    (next: Badges) =>
      setReported((prev) =>
        prev.hubId === hubId && sameBadges(prev.values, next)
          ? prev
          : { hubId, values: next },
      ),
    [hubId],
  );
  const refreshMenu = useCallback(() => setMenuRefresh((n) => n + 1), []);
  const reportLoading = useCallback(
    (change: number) => setLoading((n) => n + change),
    [],
  );
  const reportFailure = useCallback(
    (id: string, reason: string | null) =>
      setFailures((prev) => {
        if (reason === null) {
          if (!(id in prev)) return prev;
          const { [id]: _gone, ...rest } = prev;
          return rest;
        }
        return prev[id] === reason ? prev : { ...prev, [id]: reason };
      }),
    [],
  );
  const failure = Object.values(failures)[0];
  const showAnswer = useCallback(
    (answer: ChatAnswer | null) => {
      if (answer?.kind === "suggestions") {
        setReviewed((prev) => ({
          hubId,
          page: answer.fill.page,
          id: Math.max((prev?.id ?? 0) + 1, Date.now()),
          fill: answer.fill,
        }));
        return;
      }
      if (answer?.kind === "form") {
        const target = formTarget(hubId, answer);
        setAnswered({ hubId, answer: null });
        navigate(target.to, { state: target.state });
        return;
      }
      setAnswered({ hubId, answer });
    },
    [hubId, navigate],
  );
  useEffect(() => {
    setReviewed((prev) => (prev?.hubId === hubId ? prev : loadReview(hubId)));
  }, [hubId]);
  useEffect(() => {
    if (reviewed) saveReview(reviewed.hubId, reviewed);
  }, [reviewed]);
  const closeReview = useCallback(() => {
    saveReview(hubId, null);
    setReviewed(null);
  }, [hubId]);
  const reloadPage = useCallback(
    (changedPage: string) => {
      setMenuRefresh((n) => n + 1);
      setPageRound((n) => n + 1);
      const to = hubPath(hubId, changedPage);
      navigate(to, { replace: pathname === to });
    },
    [hubId, navigate, pathname],
  );
  const askChat: Ask = useCallback(
    (...given) => {
      setRail(false);
      asks.ask(...given);
    },
    [asks.ask],
  );
  const tellChat = useCallback(
    (text: string) =>
      setTold((prev) => ({ hubId, id: Math.max((prev?.id ?? 0) + 1, Date.now()), text })),
    [hubId],
  );
  const clearAnswer = useCallback(() => showAnswer(null), [showAnswer]);
  const toggleRail = useCallback(() => setRail((collapsed) => !collapsed), []);

  const value = useMemo<ConsoleContext>(
    () => ({ hub, page, setBadges, refreshMenu }),
    [hub, page, setBadges, refreshMenu],
  );

  return (
    <ConsoleCtx.Provider value={value}>
      <DraftCtx.Provider value={draft}>
        <NoticeCtx.Provider value={notice}>
          <ChatTellCtx.Provider value={tellChat}>
            <ChatAskCtx.Provider value={askChat}>
              <ChatFillCtx.Provider value={asks.fill}>
                <ChipWordsCtx.Provider value={setChipWords}>
                  <LoadingCtx.Provider value={reportLoading}>
                    <FailureCtx.Provider value={reportFailure}>
                      <div className="app console" data-theme={theme}>
                        <Strip hubs={hubs} hub={hub} page={page} />
                        <div className="cols">
                          <Menu
                            hubId={hubId}
                            kind={kindOf(hub)}
                            role={hub.role}
                            page={page}
                            badges={badges}
                          />
                          <main className="main">
                            {failure ? (
                              <StatusLine
                                text={t("loadFailedBecause").replace("{reason}", failure)}
                                failed
                              />
                            ) : null}
                            <ReviewTabs
                              hubId={hubId}
                              page={page}
                              pageTab={itemPageOf(page, search)}
                              review={reviewed?.hubId === hubId ? reviewed : null}
                              onClose={closeReview}
                              lead={
                                <>
                                  <DraftSlot
                                    hubId={hubId}
                                    page={page}
                                    draft={draft}
                                  />
                                  <AnswerSlot
                                    answer={
                                      answered.hubId === hubId
                                        ? answered.answer
                                        : null
                                    }
                                    onClear={clearAnswer}
                                  />
                                </>
                              }
                            >
                              <Fragment key={pageRound}>
                                <Outlet />
                              </Fragment>
                            </ReviewTabs>
                            {loading > 0 ? <Loading /> : null}
                          </main>
                          <ChatColumn
                            key={hubId}
                            hubId={hubId}
                            page={page}
                            rail={rail}
                            onToggleRail={toggleRail}
                            onAnswer={showAnswer}
                            onChanged={reloadPage}
                            told={told?.hubId === hubId ? told : null}
                            queue={asks.queue}
                            onTake={asks.take}
                            onCancelQueued={asks.cancel}
                            onCancelAll={asks.cancelAll}
                            chipWords={chipWords}
                          />
                        </div>
                      </div>
                    </FailureCtx.Provider>
                  </LoadingCtx.Provider>
                </ChipWordsCtx.Provider>
              </ChatFillCtx.Provider>
            </ChatAskCtx.Provider>
          </ChatTellCtx.Provider>
        </NoticeCtx.Provider>
      </DraftCtx.Provider>
    </ConsoleCtx.Provider>
  );
}

export function Frame() {
  const { hubId } = useParams();
  const { signedIn, hubs, restore } = useSession();
  const navigate = useNavigate();
  const restoreTried = useRef(false);

  useEffect(() => {
    if (restoreTried.current) return;
    restoreTried.current = true;
    if (signedIn) return;
    restore()
      .catch(() => false)
      .then((restored) => {
        if (!restored) navigate("/login", { replace: true });
      });
  }, [signedIn, restore, navigate]);

  if (!signedIn) return <Loading />;
  const hub = hubs.find((h) => h.id === hubId);
  if (!hub) return <Navigate to="/" replace />;
  return <Shell hubs={hubs} hub={hub} />;
}
