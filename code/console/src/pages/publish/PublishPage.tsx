import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hubPath } from "../../api";
import type { DraftChange, DraftProblem, PublishedVersion as PublishedVersionRow, PublishOutcome } from "../../data/draft";
import type { Scenario } from "../../data/scenario";
import { useI18n } from "../../i18n";
import { Button, Cell, Chip, DataTable, Empty, SectionTitle, Stack, TextLink, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { ResultChip } from "../test/ResultChip";
import { testPath } from "../test/paths";
import { PageContent } from "../work/PageContent";
import { formatWhen } from "../work/formatWhen";
import { PublishedVersion } from "./PublishedVersion";
import { isReady, loadPublishState, publishNow } from "./publishData";

type Hub = { hubId: string };

function Changes({ hubId, changes }: Hub & { changes: DraftChange[] }) {
  const { t, lang } = useI18n();
  const rows = changes.map((change) => ({
    key: change.id,
    cells: [
      <Chip key="kind" kind="mute">
        {t(change.kindWord)}
      </Chip>,
      <Cell key="title" text={change.title} sub={change.summary === change.title ? undefined : change.summary} />,
      change.decidedBy,
      <span key="when" className="count">
        {formatWhen(change.at, lang)}
      </span>,
    ],
    actions: (
      <TextLink to={hubPath(hubId, change.page)} arrow size="sm">
        {t("draft.open")}
      </TextLink>
    ),
  }));
  return (
    <section>
      <Stack gap={8}>
        <SectionTitle title={t("draft.label")} />
        <DataTable columns={[t("draft.colKind"), t("draft.colTitle"), t("draft.colApprovedBy"), t("draft.colWhen")]} rows={rows} empty={t("draft.nothingWaiting")} />
      </Stack>
    </section>
  );
}

function Versions({ hubId, versions }: Hub & { versions: PublishedVersionRow[] }) {
  const { t, lang } = useI18n();
  const rows = versions.map((one) => ({
    key: String(one.version),
    cells: [
      <Cell key="version" text={one.tag || "v" + one.version} to={hubPath(hubId, "publish") + "?version=" + one.version} />,
      one.channel ? (
        <Chip key="channel" kind="mute">
          {one.channel}
        </Chip>
      ) : (
        <span key="channel" className="count">
          {t("publish.archived")}
        </span>
      ),
      <span key="when" className="count">
        {formatWhen(one.at, lang)}
      </span>,
    ],
    actions: (
      <TextLink to={hubPath(hubId, "publish") + "?version=" + one.version} arrow size="sm">
        {t("draft.open")}
      </TextLink>
    ),
  }));
  return (
    <section>
      <Stack gap={8}>
        <SectionTitle title={t("publish.versions")} />
        <DataTable columns={[t("publish.colVersion"), t("publish.colChannel"), t("draft.colWhen")]} rows={rows} empty={t("publish.noVersions")} />
      </Stack>
    </section>
  );
}

function NotPassed({ hubId, scenarios }: Hub & { scenarios: Scenario[] }) {
  const { t } = useI18n();
  const rows = scenarios.map((scenario) => ({
    key: scenario.id,
    cells: [<Cell key="name" text={scenario.name} to={testPath(hubId, { open: scenario.id })} />, <ResultChip key="result" result={scenario.result} />],
    actions: (
      <TextLink to={testPath(hubId, scenario.lastRunId === "" ? { open: scenario.id } : { run: scenario.lastRunId })} arrow size="sm">
        {t(scenario.lastRunId === "" ? "publish.run" : "publish.openRun")}
      </TextLink>
    ),
  }));
  return (
    <section>
      <Stack gap={8}>
        <SectionTitle title={t("publish.notPassed")} />
        <p className="soft">{t("publish.warning")}</p>
        <DataTable columns={[t("publish.colScenario"), t("publish.colResult")]} rows={rows} empty="" />
      </Stack>
    </section>
  );
}

function Ready() {
  const { t } = useI18n();
  return (
    <Stack gap={4}>
      <strong>{t("publish.passed")}</strong>
      <p className="soft">{t("publish.reach")}</p>
    </Stack>
  );
}

export function PublishPage({ hubId }: Hub) {
  const [params] = useSearchParams();
  const version = Number(params.get("version"));
  if (Number.isInteger(version) && version > 0) return <PublishedVersion hubId={hubId} version={version} />;
  return <PublishList hubId={hubId} />;
}

function PublishList({ hubId }: Hub) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadPublishState(hubId), [hubId]);
  const [outcome, setOutcome] = useState<PublishOutcome | "failed" | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.kind === "loading") return <TitleRow title={t("menu.publish")} />;
  if (state.kind === "failed")
    return (
      <>
        <TitleRow title={t("menu.publish")} />
        <PageContent>
          <Empty text={t("loadFailed")} failed />
        </PageContent>
      </>
    );

  const loaded = state.value;
  const published = outcome !== null && outcome !== "failed" && "published" in outcome ? outcome.published : null;
  const problems: DraftProblem[] = outcome !== null && outcome !== "failed" && "problems" in outcome ? outcome.problems : [];
  const publish = async () => {
    setBusy(true);
    try {
      setOutcome(await publishNow(hubId));
    } catch {
      setOutcome("failed");
    }
    setBusy(false);
  };

  return (
    <>
      <TitleRow title={t("menu.publish")}>
        <Button disabled={!isReady(loaded) || busy || published !== null} onClick={publish}>
          {t("draft.publish")}
        </Button>
      </TitleRow>
      <PageContent>
        <Stack gap={20}>
          {published ? <strong>{t("draft.publishedAs").replace("{version}", String(published.version))}</strong> : null}
          {outcome === "failed" ? <Empty text={t("draft.publishFailed")} failed /> : null}
          {problems.map((problem) => (
            <Empty
              key={problem.message + (problem.word ?? "")}
              text={problem.word ? t(problem.word) : problem.message}
              failed
              action={
                problem.to && problem.open ? (
                  <TextLink to={problem.to} arrow size="sm">
                    {t(problem.open)}
                  </TextLink>
                ) : undefined
              }
            />
          ))}
          <Changes hubId={hubId} changes={loaded.changes} />
          {loaded.notPassed.length > 0 ? <NotPassed hubId={hubId} scenarios={loaded.notPassed} /> : <Ready />}
          <Versions hubId={hubId} versions={loaded.published} />
        </Stack>
      </PageContent>
    </>
  );
}
