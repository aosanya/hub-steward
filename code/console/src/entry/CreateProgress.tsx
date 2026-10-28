import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import type { Hub } from "../types";
import { Button, Card, Progress, Row } from "../ui";
import { Icon } from "../ui/Icon";
import { ErrorLine } from "./ErrorLine";
import { roomNames, setupStages } from "./hubSetup";
import { StepList, type Step } from "./StepList";

export type Phase =
  | { kind: "form" }
  | { kind: "creating"; done: number; hub: Hub | null }
  | { kind: "ready"; hub: Hub }
  | { kind: "failed"; done: number; message: string; hub: Hub | null };

type CreateProgressProps = {
  phase: Exclude<Phase, { kind: "form" }>;
  counts: string;
  onOpen: (hub: Hub) => void;
  onBack: () => void;
  onHubs: () => void;
};

const stepsDone = (phase: CreateProgressProps["phase"]) => (phase.kind === "ready" ? setupStages : phase.done);

export function CreateProgress({ phase, counts, onOpen, onBack, onHubs }: CreateProgressProps) {
  const { t } = useI18n();
  const done = stepsDone(phase);
  const hubName = "hub" in phase && phase.hub ? phase.hub.name : "";
  const results: ReactNode[] = [[hubName, counts].filter(Boolean).join(" · "), t("connected"), roomNames.join(", ")];
  const titles = [t("createStepTemplate"), t("createStepAgent"), t("createStepGroups")];

  const steps: Step[] = titles.map((title, index) => {
    if (index < done) return { title, meta: results[index], state: "done" };
    if (index === done && phase.kind === "failed") return { title, meta: t("createFailedStep"), state: "failed" };
    if (index === done && phase.kind === "creating") return { title, meta: t("createRunning"), state: "now" };
    return { title, meta: t("createWaiting"), state: "next" };
  });

  const progress = (
    <Progress
      pct={Math.round((done * 100) / setupStages)}
      label={t("createProgress").replace("{done}", String(done)).replace("{total}", String(setupStages))}
    />
  );

  if (phase.kind === "creating") {
    return (
      <Card title={t("createCreating")} className="ent-card">
        {progress}
        <StepList steps={steps} />
      </Card>
    );
  }

  if (phase.kind === "ready") {
    return (
      <Card className="ent-card">
        <div className="ent-head">
          <span className="ent-badge">
            <Icon name="check" size={14} stroke={3} />
          </span>
          <h2>{t("createReady")}</h2>
        </div>
        <StepList steps={steps} />
        <Button icon="arrow" wide onClick={() => onOpen(phase.hub)}>
          {t("createOpenStatus")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="ent-card">
      <div className="ent-head">
        <span className="ent-badge bad">
          <Icon name="cross" size={14} stroke={3} />
        </span>
        <h2>{t("createCreating")}</h2>
      </div>
      {progress}
      <StepList steps={steps} />
      <ErrorLine>{phase.message}</ErrorLine>
      <Row>
        <Button kind="quiet" onClick={onBack}>
          {t("back")}
        </Button>
        <Button kind="quiet" icon="arrow" onClick={onHubs}>
          {t("hubYours")}
        </Button>
      </Row>
    </Card>
  );
}
