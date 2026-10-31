import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listRisks, riskLanding } from "../../data/pages/risks";
import { useI18n } from "../../i18n";
import { ButtonLink, Empty, IconButton, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { RiskDetail } from "./RiskDetail";
import { RisksList } from "./RisksList";
import { risksHref } from "./risksLinks";

const load = async (hubId: string, wanted: string) => {
  const risks = await listRisks(hubId);
  const chosen = risks.find(
    (risk) => risk.id === wanted || risk.code === wanted,
  );
  return { risks, landing: chosen ? await riskLanding(hubId, chosen) : null };
};

export function RisksLanding({ hubId }: { hubId: string }) {
  const [params] = useSearchParams();
  const wanted = params.get("risk") ?? "";
  return <RisksPage key={wanted} hubId={hubId} wanted={wanted} />;
}

function RisksPage({ hubId, wanted }: { hubId: string; wanted: string }) {
  const { t } = useI18n();
  const { state, reload } = useLoaded(() => load(hubId, wanted), [hubId, wanted]);
  const [editing, setEditing] = useState(false);
  const addLink = risksHref(hubId, { add: true });

  const landing = state.kind === "ready" ? state.value.landing : null;
  const header = wanted ? (
    <TitleRow title={landing?.risk.title ?? t("menu.bowties")}>
      {landing && !editing ? (
        <IconButton
          icon="edit"
          label={t("risks.edit")}
          onClick={() => setEditing(true)}
        />
      ) : null}
    </TitleRow>
  ) : (
    <TitleRow
      title={t("menu.bowties")}
      primary={t("risks.add")}
      primaryTo={addLink}
    />
  );

  const body = () => {
    if (state.kind === "loading") return null;
    if (state.kind === "failed")
      return <Empty text={t("loadFailed")} failed />;
    const { risks, landing: found } = state.value;
    if (wanted) {
      if (!found) return <Empty text={t("noRows")} />;
      const edited = () => {
        setEditing(false);
        reload();
      };
      return (
        <RiskDetail
          hubId={hubId}
          landing={found}
          editing={editing}
          onEdited={edited}
          onCancel={() => setEditing(false)}
          reload={reload}
        />
      );
    }
    if (risks.length === 0)
      return (
        <Empty
          text={t("risks.none")}
          action={
            <ButtonLink to={addLink} icon="plus">
              {t("risks.add")}
            </ButtonLink>
          }
        />
      );
    return <RisksList hubId={hubId} risks={risks} />;
  };

  return (
    <>
      {header}
      <div className="content">{body()}</div>
    </>
  );
}
