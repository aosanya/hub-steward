import { useNavigate } from "react-router-dom";
import { createControl } from "../../data/pages/controls";
import { useI18n } from "../../i18n";
import { TitleRow } from "../../ui";
import { blankFields, type ControlFields } from "./controlFields";
import { ControlForm } from "./ControlForm";
import { controlsHref } from "./controlsLinks";

export function ControlAdd({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const back = controlsHref(hubId);
  const save = async (fields: ControlFields) => {
    await createControl(hubId, { ...fields });
  };
  return (
    <>
      <TitleRow title={t("controls.add")} />
      <div className="content">
        <ControlForm hubId={hubId} title={t("controls.newControl")} initial={blankFields} save={save} onSaved={() => navigate(back)} onCancel={() => navigate(back)} />
      </div>
    </>
  );
}
