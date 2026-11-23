import type { HubKind } from "../../data/hubKind";
import { areaPageOf, readsEveryArea, reviewProgress, type AreaName } from "../../data/reviewApi";
import { useI18n } from "../../i18n";
import { Empty, Stack, PageHeader } from "../../ui";
import { AreaBody } from "./AreaBody";
import { AreaCards } from "./AreaCards";
import { ProgressCard } from "./ProgressCard";
import { RunCard } from "./RunCard";
import { useReview } from "./useReview";

type Props = { hubId: string; kind: HubKind; area?: AreaName };

export function ReviewPageView({ hubId, kind, area }: Props) {
  const { t } = useI18n();
  const { page, state, error, starting, start, replaceFinding } = useReview(hubId, area);
  const areaName = area ? t(`menu.${areaPageOf(area)}`) : "";
  const title = area ? t("review.areaTitle").replace("{area}", areaName) : t("menu.publish-review");
  const runLabel = area ? t("review.runArea").replace("{area}", areaName) : t("review.run");
  const runAgainLabel = area ? t("review.runAreaAgain").replace("{area}", areaName) : t("review.runAgain");
  const notReviewed = area ? t("review.areaEmpty").replace("{area}", areaName) : t("review.empty");

  if (state === "loading") return <PageHeader title={title} />;
  if (state === "failed")
    return (
      <>
        <PageHeader title={title} />
        <div className="content">
          <Empty text={error || t("review.loadFailed")} failed />
        </div>
      </>
    );

  const row = area && page ? page.areas.find((candidate) => candidate.area === area) : undefined;

  if (page === null || (area && !row))
    return (
      <>
        <PageHeader title={title} />
        <div className="content">
          <RunCard onRun={start} busy={starting} refusal={error} text={notReviewed} label={runLabel} />
        </div>
      </>
    );

  const reading = page.review.status === "running" && (area ? row?.status === "reading" : readsEveryArea(page));
  if (reading)
    return (
      <>
        <PageHeader title={title} />
        <div className="content">
          <ProgressCard progress={reviewProgress(page)} area={areaName || undefined} />
        </div>
      </>
    );

  return (
    <>
      <PageHeader title={title} actions={[{ label: runAgainLabel, icon: "refresh", primary: true, disabled: starting, onClick: () => void start() }]} />
      <div className="content">
        <Stack gap={20}>
          {error ? <Empty text={error} failed /> : null}
          {!area ? (
            <AreaCards hubId={hubId} kind={kind} page={page} />
          ) : row ? (
            <AreaBody hubId={hubId} row={row} onFinding={replaceFinding} />
          ) : null}
        </Stack>
      </div>
    </>
  );
}
