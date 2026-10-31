import { useNavigate } from "react-router-dom";
import { updateControl } from "../../data/pages/controls";
import { useI18n } from "../../i18n";
import { Empty, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { loadControlFields, type ControlFields } from "./controlFields";
import { ControlAttachments } from "./ControlAttachments";
import { ControlForm } from "./ControlForm";
import { controlsHref } from "./controlsLinks";

export function ControlEdit({ hubId, controlId }: { hubId: string; controlId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state } = useLoaded(() => loadControlFields(hubId, controlId), [hubId, controlId]);
  const back = controlsHref(hubId);
  const save = async (fields: ControlFields) => {
    await updateControl(hubId, { ...fields, control_id: controlId });
  };

  const body = () => {
    if (state.kind === "loading") return null;
    if (state.kind === "failed") return <Empty text={t("loadFailed")} failed />;
    if (!state.value) return <Empty text={t("noRows")} />;
    return (
      <>
        <ControlAttachments hubId={hubId} controlId={controlId} />
        <ControlForm hubId={hubId} title={t("controls.editControl")} initial={state.value.fields} save={save} onSaved={() => navigate(back)} onCancel={() => navigate(back)} />
      </>
    );
  };

  return (
    <>
      <TitleRow title={state.kind === "ready" && state.value ? state.value.code || t("controls.editControl") : t("controls.editControl")} />
      <div className="content">{body()}</div>
    </>
  );
}
