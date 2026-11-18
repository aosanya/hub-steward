import { loadRowChains } from "../../liveRecordRows";
import { listOf, text } from "../staff/staffData";
import { approvedWords, decisionStatus } from "../services/decision";

const licenceKind = "licence";

const listedRowIds = async (): Promise<Set<string>> => {
  const entries = await listOf("forms_catalog_entry_list_public", { kind: licenceKind });
  const formIds = entries.map((entry) => text(entry, "form_id")).filter(Boolean);
  const sends = (await Promise.all(formIds.map((form_id) => listOf("forms_submission_list", { form_id })))).flat();
  return new Set(
    sends
      .filter((sent) => decisionStatus(text(sent, "decision")) === approvedWords)
      .map((sent) => text(sent, "record_row_id"))
      .filter(Boolean),
  );
};

export const loadLicensedRowIds = async (recordCode: string): Promise<Set<string> | null> => {
  try {
    const [named, chains] = await Promise.all([listedRowIds(), loadRowChains(recordCode)]);
    return new Set([...chains].filter(([, chain]) => chain.some((id) => named.has(id))).map(([current]) => current));
  } catch {
    return null;
  }
};
