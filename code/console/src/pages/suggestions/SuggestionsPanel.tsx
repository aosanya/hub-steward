import { useEffect, useState } from "react";
import type { Suggestion, SuggestionsFill } from "../../data/chatAnswer";
import { applySuggestion } from "../../data/chatSuggestions";
import { findingBackground } from "../../data/findingBackground";
import { loadProgress, saveProgress } from "../../data/reviewMemory";
import { useI18n } from "../../i18n";
import { useTellChat } from "../../shell/chatTell";
import { useConsole } from "../../shell/context";
import {
  Button,
  Card,
  Cell,
  Empty,
  Note,
  RowActions,
  Stack,
  StatusLine,
} from "../../ui";
import { PageContent } from "../work/PageContent";

type Progress = "working" | "done" | { failed: string };

const isFailed = (state: Progress | undefined): state is { failed: string } =>
  typeof state === "object";

const questionAbout = (item: Suggestion, text: string) =>
  `About your suggestion "${item.title}"${item.detail ? ` (${item.detail})` : ""}: ${text}`;

function SuggestionCard({
  hubId,
  page,
  item,
  state,
  onApply,
  onDetails,
  onDismiss,
}: {
  hubId: string;
  page: string;
  item: Suggestion;
  state: Progress | undefined;
  onApply: () => void;
  onDetails: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  return (
    <Card
      title={item.title}
      open={expanded}
      onToggle={() => setExpanded((now) => !now)}
      className="suggestion"
    >
      {item.detail ? <Cell text={item.detail} strong={false} /> : null}
      {isFailed(state) ? <StatusLine text={state.failed} failed /> : null}
      <RowActions
        question={(text) => questionAbout(item, text)}
        background={() => findingBackground(hubId, item, page)}
        hasTool={item.tool !== ""}
        enhance={{
          message: t("enhance.finding")
            .replace("{title}", item.title)
            .replace("{detail}", item.detail),
          shown: t("enhance.findingShown").replace("{title}", item.title),
        }}
        state={state === "done" ? "applied" : "open"}
        busy={state === "working" ? "applying" : undefined}
        onApply={onApply}
        onDetails={onDetails}
        onDismiss={onDismiss}
      />
    </Card>
  );
}

export function SuggestionsPanel({
  hubId,
  reviewId,
  fill,
  onDetails,
}: {
  hubId: string;
  reviewId: number;
  fill: SuggestionsFill;
  onDetails: (item: Suggestion) => void;
}) {
  const { t } = useI18n();
  const { refreshMenu } = useConsole();
  const tellChat = useTellChat();
  const [kept] = useState(() => loadProgress(hubId, reviewId));
  const [progress, setProgress] = useState<Record<number, Progress>>(() =>
    Object.fromEntries(kept.done.map((index) => [index, "done" as const])),
  );
  const [dismissed, setDismissed] = useState<number[]>(kept.dismissed);

  useEffect(() => {
    const done = Object.entries(progress)
      .filter(([, state]) => state === "done")
      .map(([index]) => Number(index));
    saveProgress(hubId, reviewId, { done, dismissed });
  }, [hubId, reviewId, progress, dismissed]);

  const open = fill.items
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => !dismissed.includes(index));
  const waiting = open.filter(
    ({ item, index }) =>
      item.tool !== "" &&
      (progress[index] === undefined || isFailed(progress[index])),
  );
  const busy = Object.values(progress).includes("working");

  const apply = async (index: number) => {
    setProgress((now) => ({ ...now, [index]: "working" }));
    try {
      await applySuggestion(hubId, fill.page, fill.items[index]);
      setProgress((now) => ({ ...now, [index]: "done" }));
      refreshMenu();
      tellChat(
        t("suggest.appliedTold").replace("{title}", fill.items[index].title),
      );
    } catch (error) {
      setProgress((now) => ({
        ...now,
        [index]: {
          failed: error instanceof Error ? error.message : t("suggest.failed"),
        },
      }));
    }
  };

  const applyAll = async () => {
    for (const { index } of waiting) await apply(index);
  };

  const cards = open.map(({ item, index }) => (
    <SuggestionCard
      key={index}
      hubId={hubId}
      page={fill.page}
      item={item}
      state={progress[index]}
      onApply={() => apply(index)}
      onDetails={() => onDetails(item)}
      onDismiss={() => setDismissed((now) => [...now, index])}
    />
  ));

  return (
    <PageContent>
      {fill.summary ? <Note>{fill.summary}</Note> : null}
      {waiting.length > 1 ? (
        <Button disabled={busy} onClick={applyAll}>
          {t("suggest.applyAll")}
        </Button>
      ) : null}
      {cards.length ? (
        <Stack gap={16}>{cards}</Stack>
      ) : (
        <Empty text={t("suggest.none")} />
      )}
    </PageContent>
  );
}
