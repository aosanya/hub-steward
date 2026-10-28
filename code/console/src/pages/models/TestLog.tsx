import { useI18n } from "../../i18n";
import { Stack } from "../../ui";
import { Icon } from "../../ui/Icon";
import type { TestRun } from "./useTestRun";

type Done = Extract<TestRun, { phase: "done" }>;

const fill = (text: string, name: string, value: string) => text.replace(`{${name}}`, () => value);

export function TestLog({ run, provider }: { run: TestRun; provider: string }) {
  const { t } = useI18n();
  if (run.phase === "idle") return null;

  if (run.phase === "sending") {
    return (
      <div role="status">
        <span className="muted">{fill(t("models.testSending"), "provider", provider)}</span>
      </div>
    );
  }

  const timed = (text: string, done: Done) => (done.tookMs === null ? text : `${text} · ${fill(t("models.testMs"), "ms", String(done.tookMs))}`);
  const answer = run.reply === "" ? t("models.testAnsweredOnly") : fill(t("models.testAnswered"), "reply", run.reply);
  const refusal = fill(t("models.testNotWorking"), "reason", run.reason || t("models.noAnswer"));

  return (
    <div role="status">
      <Stack gap={6}>
        {run.prompt !== "" && <span className="muted">{fill(t("models.testSent"), "prompt", run.prompt)}</span>}
        <span className={run.working ? "mk-result" : "mk-result bad"}>
          <Icon name={run.working ? "check" : "cross"} size={16} stroke={2.6} />
          {timed(run.working ? answer : refusal, run)}
        </span>
      </Stack>
    </div>
  );
}
