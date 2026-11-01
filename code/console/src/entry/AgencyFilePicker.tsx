import { useI18n } from "../i18n";
import { Field } from "../ui";
import { countsOf } from "./counts";
import type { AgencyFile } from "./agencyFile";
import { ErrorLine } from "./ErrorLine";

const spec = { name: "agencyFile", component: "file" } as const;

type AgencyFilePickerProps = { file: File | null; agency: AgencyFile | null; failed: boolean; onPick: (file: File | null) => void };

export function AgencyFilePicker({ file, agency, failed, onPick }: AgencyFilePickerProps) {
  const { t } = useI18n();
  return (
    <>
      <Field spec={spec} value={file} onChange={(value) => onPick(value instanceof File ? value : null)} />
      {agency ? (
        <p className="count">
          {[agency.name, countsOf(agency, t)].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {failed ? <ErrorLine>{t("createFileBad")}</ErrorLine> : null}
    </>
  );
}
