import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n";
import type { Part, RiskLanding } from "../../data/pages/risks";
import { Button, Card, IconButton, Row, Stack, Tabs } from "../../ui";
import { PartAdd } from "./PartAdd";
import { PartTable } from "./PartTable";
import { RiskEditForm } from "./RiskEditForm";
import {
  deletePathway,
  deleteRisk,
  unlinkPart,
  type PartSide,
} from "./riskAddWrite";
import { risksHref } from "./risksLinks";

type RiskDetailProps = {
  hubId: string;
  landing: RiskLanding;
  editing: boolean;
  onEdited: () => void;
  onCancel: () => void;
  reload: () => void;
};

export function RiskDetail({
  hubId,
  landing,
  editing,
  onEdited,
  onCancel,
  reload,
}: RiskDetailProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const side: PartSide =
    params.get("tab") === "consequences" ? "consequence" : "threat";
  const { risk, threats, consequences, library, hazardTitle } = landing;
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const remove = async () => {
    setBusy(true);
    setProblem("");
    try {
      await deleteRisk(hubId, risk.id);
    } catch {
      setBusy(false);
      setProblem(t("submitFailed"));
      return;
    }
    navigate(risksHref(hubId));
  };

  const removePart = (side: PartSide) => async (part: Part) => {
    try {
      if (part.legacy) await deletePathway(hubId, part.id);
      else await unlinkPart(hubId, side, part.linkId);
      reload();
    } catch {
      setProblem(t("submitFailed"));
    }
  };

  return (
    <Stack gap={20}>
      {removing ? (
        <Card tight>
          <span>{t("risks.deleteAsk").replace("{name}", risk.title)}</span>
          {problem ? (
            <p className="field-error error" role="alert">
              {problem}
            </p>
          ) : null}
          <Row>
            <Button kind="danger" size="sm" disabled={busy} onClick={remove}>
              {t("risks.deleteConfirm")}
            </Button>
            <Button
              kind="quiet"
              size="sm"
              disabled={busy}
              onClick={() => setRemoving(false)}
            >
              {t("cancel")}
            </Button>
          </Row>
        </Card>
      ) : null}
      {editing ? (
        <RiskEditForm
          hubId={hubId}
          risk={risk}
          onSaved={onEdited}
          onCancel={onCancel}
        />
      ) : null}
      <Card
        title={risk.code ? `${risk.code} · ${risk.title}` : risk.title}
        actions={
          <IconButton
            icon="trash"
            label={t("risks.delete")}
            danger
            onClick={() => setRemoving(true)}
          />
        }
      >
        {risk.topEvent ? <p>{risk.topEvent}</p> : null}
        <p>
          <span className="term">{t("risks.hazard")}:</span> {hazardTitle}
        </p>
        <p>
          <span className="term">{t("risks.owner")}:</span>{" "}
          {risk.owner || t("risks.noOwner")}
        </p>
      </Card>
      <Tabs
        items={[
          {
            to: risksHref(hubId, { risk: risk.id }),
            label: t("risks.threats").replace("{n}", String(threats.length)),
            current: side === "threat",
          },
          {
            to: risksHref(hubId, { risk: risk.id, tab: "consequences" }),
            label: t("risks.consequences").replace(
              "{n}",
              String(consequences.length),
            ),
            current: side === "consequence",
          },
        ]}
      />
      {side === "threat" ? (
        <>
          <PartTable
            first={t("risks.threat")}
            parts={threats}
            onRemove={removePart("threat")}
          />
          <PartAdd
            hubId={hubId}
            riskCode={risk.code}
            side="threat"
            hazardCode={risk.hazardCode}
            library={library.threats}
            linked={threats}
            onSaved={reload}
          />
        </>
      ) : (
        <>
          <PartTable
            first={t("risks.consequence")}
            parts={consequences}
            onRemove={removePart("consequence")}
          />
          <PartAdd
            hubId={hubId}
            riskCode={risk.code}
            side="consequence"
            hazardCode={risk.hazardCode}
            library={library.consequences}
            linked={consequences}
            onSaved={reload}
          />
        </>
      )}
    </Stack>
  );
}
