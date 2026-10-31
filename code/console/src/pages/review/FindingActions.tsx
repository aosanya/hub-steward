import { useState } from "react";
import { setFindingStatus, type Finding } from "../../data/reviewApi";
import { useI18n } from "../../i18n";
import { useTellChat } from "../../shell/chatTell";
import { findingBackground, suggestionOf } from "../../data/findingBackground";
import { useOpenDetails } from "../../shell/detailsContext";
import { useConsole } from "../../shell/context";
import { RowActions, StatusLine } from "../../ui";
import { applyFinding, questionAboutFinding } from "./applyFinding";
import { FindingNotes } from "./FindingNotes";

type Progress = "idle" | "applying" | "settling" | { failed: string };

const isFailed = (state: Progress): state is { failed: string } =>
  typeof state === "object";

const sentenceOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

type FindingActionsProps = {
  hubId: string;
  finding: Finding;
  onFinding: (finding: Finding) => void;
  area?: string;
  withDetails?: boolean;
};

export function FindingActions({
  hubId,
  finding,
  onFinding,
  area,
  withDetails = true,
}: FindingActionsProps) {
  const { t } = useI18n();
  const { refreshMenu } = useConsole();
  const tellChat = useTellChat();
  const openDetails = useOpenDetails();
  const [progress, setProgress] = useState<Progress>("idle");
  const [noting, setNoting] = useState(false);
  const applying = progress === "applying";
  const settling = progress === "settling";
  const dismissed = finding.status === "dismissed";
  const applied = finding.status === "applied";
  const advice = finding.tool === "";
  const background = () =>
    findingBackground(
      hubId,
      suggestionOf(finding),
      area ?? "",
      finding.comments.map((note) => note.body),
    );

  const fail = (error: unknown) =>
    setProgress({ failed: sentenceOf(error, t("suggest.failed")) });

  const apply = async () => {
    setProgress("applying");
    try {
      const updated = await applyFinding(hubId, finding);
      setProgress("idle");
      onFinding(updated);
      refreshMenu();
      tellChat(t("suggest.appliedTold").replace("{title}", finding.title));
    } catch (error) {
      fail(error);
    }
  };

  const setStatus = async (status: "dismissed" | "open") => {
    setProgress("settling");
    try {
      const updated = await setFindingStatus(hubId, finding.id, status);
      setProgress("idle");
      onFinding(updated);
      refreshMenu();
    } catch (error) {
      fail(error);
    }
  };

  const resolve = async () => {
    try {
      onFinding(await setFindingStatus(hubId, finding.id, "applied"));
      refreshMenu();
    } catch (error) {
      fail(error);
    }
  };

  return (
    <>
      {isFailed(progress) ? <StatusLine text={progress.failed} failed /> : null}
      <FindingNotes
        hubId={hubId}
        finding={finding}
        onFinding={onFinding}
        open={noting}
        onClose={() => setNoting(false)}
      />
      <RowActions
        question={(text) => questionAboutFinding(finding, text)}
        background={background}
        hasTool={!advice}
        enhance={{
          message: t("enhance.finding")
            .replace("{title}", finding.title)
            .replace("{detail}", finding.detail),
          shown: t("enhance.findingShown").replace("{title}", finding.title),
          onChanged: resolve,
        }}
        state={dismissed ? "dismissed" : applied ? "applied" : "open"}
        busy={applying ? "applying" : settling ? "settling" : undefined}
        onApply={apply}
        onDismiss={() => setStatus("dismissed")}
        onUndo={() => setStatus("open")}
        onComment={() => setNoting((now) => !now)}
        commenting={noting}
        onDetails={
          withDetails
            ? () =>
                openDetails(
                  suggestionOf(finding),
                  <DetachedActions
                    hubId={hubId}
                    finding={finding}
                    onFinding={onFinding}
                    area={area}
                  />,
                )
            : undefined
        }
      />
    </>
  );
}

function DetachedActions({
  hubId,
  finding,
  onFinding,
  area,
}: Omit<FindingActionsProps, "withDetails">) {
  const [current, setCurrent] = useState(finding);
  const change = (next: Finding) => {
    setCurrent(next);
    onFinding(next);
  };
  return (
    <FindingActions
      hubId={hubId}
      finding={current}
      onFinding={change}
      area={area}
      withDetails={false}
    />
  );
}
