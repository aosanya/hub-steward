import { useEffect, useState, type ReactNode } from "react";
import type { Suggestion, SuggestionsFill } from "../data/chatAnswer";
import { useI18n } from "../i18n";
import { SuggestionDetails } from "../pages/suggestions/SuggestionDetails";
import { SuggestionsPanel } from "../pages/suggestions/SuggestionsPanel";
import { DetailsCtx } from "./detailsContext";
import { pageLabel } from "./labels";

const reviewPrefix = "review-";

type ReviewTabsProps = {
  hubId: string;
  page: string;
  pageTab?: string;
  review: { id: number; fill: SuggestionsFill } | null;
  onClose: () => void;
  lead?: ReactNode;
  children: ReactNode;
};

export function ReviewTabs({
  hubId,
  page,
  pageTab = page,
  review,
  onClose,
  lead,
  children,
}: ReviewTabsProps) {
  const { t } = useI18n();
  const [shown, setShown] = useState<"page" | "review" | "details">("review");
  const [detailed, setDetailed] = useState<Suggestion[]>([]);
  const [current, setCurrent] = useState<Suggestion | null>(null);
  const [actionsOf, setActionsOf] = useState<Record<string, ReactNode>>({});
  const id = review?.id;

  useEffect(() => {
    setShown("page");
  }, [page]);

  useEffect(() => {
    if (id === undefined) return;
    setShown("review");
    setDetailed([]);
    setActionsOf({});
    setCurrent(null);
  }, [id]);

  const view = shown === "review" && !review ? "page" : shown;
  const showDetails = (item: Suggestion) => {
    setCurrent(item);
    setShown("details");
  };
  const openDetails = (item: Suggestion, actions?: ReactNode) => {
    setActionsOf((now) => ({ ...now, [item.title]: actions }));
    setDetailed((now) =>
      now.some((entry) => entry.title === item.title)
        ? now.map((entry) => (entry.title === item.title ? item : entry))
        : [...now, item],
    );
    showDetails(item);
  };
  const chooseDetails = (title: string) => {
    const item = detailed.find((entry) => entry.title === title);
    if (item) showDetails(item);
  };
  const tab = (label: string, active: boolean, show: () => void) => (
    <button
      type="button"
      className="tab"
      aria-current={active ? "page" : undefined}
      onClick={show}
    >
      {label}
    </button>
  );
  const pageTabLabel = pageTab.startsWith(reviewPrefix)
    ? t("review.areaTitle").replace("{area}", pageLabel(t, pageTab.slice(reviewPrefix.length)))
    : pageLabel(t, pageTab);
  const showNav = review !== null || detailed.length > 0;
  return (
    <DetailsCtx.Provider value={openDetails}>
      {showNav ? (
        <nav className="tabs review-tabs">
          {tab(pageTabLabel, view === "page", () => setShown("page"))}
          {review ? (
            <span className="tab-closable">
              {tab(t("suggest.tab"), view === "review", () =>
                setShown("review"),
              )}
              <button
                type="button"
                className="tab-close"
                aria-label={t("suggest.close")}
                onClick={onClose}
              >
                ×
              </button>
            </span>
          ) : null}
          {detailed.length > 0 ? (
            <select
              className="tab tab-menu"
              aria-label={t("suggest.details")}
              aria-current={view === "details" ? "page" : undefined}
              value={view === "details" && current ? current.title : ""}
              onChange={(e) => chooseDetails(e.target.value)}
            >
              <option value="" disabled>
                {t("suggest.details")}
              </option>
              {detailed.map((item) => (
                <option key={item.title} value={item.title}>
                  {item.title}
                </option>
              ))}
            </select>
          ) : null}
        </nav>
      ) : null}
      {lead}
      <div className="kept" hidden={view !== "page"}>
        {children}
      </div>
      {review ? (
        <div hidden={view !== "review"}>
          <SuggestionsPanel
            key={review.id}
            hubId={hubId}
            reviewId={review.id}
            fill={review.fill}
            onDetails={openDetails}
          />
        </div>
      ) : null}
      {view === "details" && current ? (
        <SuggestionDetails
          key={current.title}
          hubId={hubId}
          suggestion={current}
          actions={actionsOf[current.title]}
        />
      ) : null}
    </DetailsCtx.Provider>
  );
}
