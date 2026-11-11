import { changesPath, type DraftChange, type DraftProblem, type DraftState, type Published } from "../data/draft";
import { useI18n } from "../i18n";
import { formatWhen } from "../pages/work/formatWhen";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { MsgCard } from "./chat/MsgCard";
import { Icon } from "./Icon";
import { Stack } from "./Layout";
import { TextLink } from "./TextLink";
import "./draftBar.css";

export type DraftBarProps = {
  hubId: string;
  state: DraftState;
  changes: DraftChange[];
  problems: DraftProblem[];
  version: Published | null;
  onPublish: () => void;
};

function PublishedLine({ version }: { version: Published }) {
  const { t, lang } = useI18n();
  return (
    <div className="row" role="status">
      <Chip kind="mute">
        <Icon name="check" size={12} stroke={2.6} />
        {t("draft.publishedAs").replace("{version}", String(version.version))}
      </Chip>
      <span className="muted">{formatWhen(version.at, lang)}</span>
    </div>
  );
}

function ProblemRow({ problem }: { problem: DraftProblem }) {
  const { t } = useI18n();
  return (
    <div className="list-row">
      <span className="list-text">
        <span>{problem.word ? t(problem.word) : problem.message}</span>
      </span>
      {problem.to && problem.open ? (
        <TextLink to={problem.to} arrow size="sm">
          {t(problem.open)}
        </TextLink>
      ) : null}
    </div>
  );
}

function ProblemsCard({ problems }: { problems: DraftProblem[] }) {
  const { t } = useI18n();
  const title = problems.length === 1 ? t("draft.failedOne") : t("draft.failedMany").replace("{n}", String(problems.length));
  return (
    <div role="alert">
      <MsgCard icon="alert" tone="bad" className="bad wide" title={title}>
        <div className="draft-problems">
          {problems.map((problem, index) => (
            <ProblemRow key={index} problem={problem} />
          ))}
        </div>
      </MsgCard>
    </div>
  );
}

function PublishButton({ state, onPublish }: { state: DraftState; onPublish: () => void }) {
  const { t } = useI18n();
  if (state === "publishing") {
    return (
      <Button size="sm" className="publish" aria-busy="true" aria-disabled="true">
        <span className="tool-spin" aria-hidden="true" />
        {t("draft.publishing")}
      </Button>
    );
  }
  return (
    <Button size="sm" className="publish" onClick={onPublish}>
      {t(state === "failed" ? "draft.publishAgain" : "draft.publish")}
    </Button>
  );
}

const countOf = (t: (key: string) => string, changes: DraftChange[], one: string, many: string) =>
  changes.length === 1 ? t(one) : t(many).replace("{n}", String(changes.length));

function BarText({ hubId, state, changes }: { hubId: string; state: DraftState; changes: DraftChange[] }) {
  const { t } = useI18n();
  if (state === "publishing") {
    return (
      <>
        <strong>{t("draft.checking")}</strong>
        {changes.length > 0 ? <span className="soft">{countOf(t, changes, "draft.countOne", "draft.countMany")}</span> : null}
      </>
    );
  }
  if (changes.length === 0) return <strong>{t("draft.notPublished")}</strong>;
  return (
    <>
      <strong>{countOf(t, changes, "draft.changesOne", "draft.changesMany")}</strong>
      <TextLink to={changesPath(hubId)} arrow size="sm">
        {t("draft.see")}
      </TextLink>
    </>
  );
}

export function DraftBar({ hubId, state, changes, problems, version, onPublish }: DraftBarProps) {
  const { t } = useI18n();

  if (state === "none") return null;
  if (state === "published") return version === null ? null : <PublishedLine version={version} />;

  const bar = (
    <section className="draft" aria-label={t("draft.label")}>
      <div className="draft-text">
        <span className="dot" aria-hidden="true" />
        <BarText hubId={hubId} state={state} changes={changes} />
      </div>
      <PublishButton state={state} onPublish={onPublish} />
    </section>
  );

  if (state !== "failed" || problems.length === 0) return bar;
  return (
    <Stack gap={12}>
      {bar}
      <ProblemsCard problems={problems} />
    </Stack>
  );
}
