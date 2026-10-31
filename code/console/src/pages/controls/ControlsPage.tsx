import { useSearchParams } from "react-router-dom";
import { listControls } from "../../data/pages/controls";
import { useI18n } from "../../i18n";
import { ButtonLink, Empty, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { ControlAdd } from "./ControlAdd";
import { ControlEdit } from "./ControlEdit";
import { ControlsList } from "./ControlsList";
import { controlsHref } from "./controlsLinks";

export function ControlsPage({ hubId }: { hubId: string }) {
  const [params] = useSearchParams();
  const wanted = params.get("control");
  if (params.get("add") === "control") return <ControlAdd hubId={hubId} />;
  if (wanted) return <ControlEdit key={wanted} hubId={hubId} controlId={wanted} />;
  return <ControlsLanding hubId={hubId} />;
}

function ControlsLanding({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const { state } = useLoaded(() => listControls(hubId), [hubId]);
  const addLink = controlsHref(hubId, { add: true });

  const body = () => {
    if (state.kind === "loading") return null;
    if (state.kind === "failed") return <Empty text={t("loadFailed")} failed />;
    if (state.value.length === 0) return <Empty text={t("controls.none")} action={<ButtonLink to={addLink} icon="plus">{t("controls.add")}</ButtonLink>} />;
    return <ControlsList hubId={hubId} controls={state.value} />;
  };

  return (
    <>
      <TitleRow title={t("menu.controls")} primary={t("controls.add")} primaryTo={addLink} />
      <div className="content">{body()}</div>
    </>
  );
}
