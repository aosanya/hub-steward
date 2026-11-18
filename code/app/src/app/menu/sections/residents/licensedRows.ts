import { loadRowChains } from "../../liveRecordRows";
import { listOf, text, type Item } from "../staff/staffData";
import { approvedWords, decisionStatus } from "../services/decision";

const licenceKind = "licence";
const validUntilPrompt = "Valid until";

export type LicenceMark = "Licensed" | "Expired" | "Not licensed";

export type ApprovedLicence = { rowId: string; validUntil: string };

export const todayIso = () => new Date().toLocaleDateString("sv-SE");

const approvedLicencesOf = async (formId: string): Promise<ApprovedLicence[]> => {
  const [sends, questions, answers] = await Promise.all([
    listOf("forms_submission_list", { form_id: formId }),
    listOf("forms_question_list", { form_id: formId }),
    listOf("forms_answer_list_all", { form_id: formId }),
  ]);
  const validQuestionId = text(questions.find((question) => text(question, "prompt") === validUntilPrompt), "id");
  const validUntilOf = (sent: Item) =>
    text(answers.find((answer) => text(answer, "member_id") === text(sent, "member_id") && text(answer, "question_id") === validQuestionId), "value_date");
  return sends
    .filter((sent) => decisionStatus(text(sent, "decision")) === approvedWords && text(sent, "record_row_id") !== "")
    .map((sent) => ({ rowId: text(sent, "record_row_id"), validUntil: validQuestionId ? validUntilOf(sent) : "" }));
};

const approvedLicences = async (): Promise<ApprovedLicence[]> => {
  const entries = await listOf("forms_catalog_entry_list_public", { kind: licenceKind });
  const formIds = entries.map((entry) => text(entry, "form_id")).filter(Boolean);
  return (await Promise.all(formIds.map(approvedLicencesOf))).flat();
};

export const markOf = (licences: ApprovedLicence[], today: string): LicenceMark => {
  if (licences.length === 0) return "Not licensed";
  return licences.some((licence) => licence.validUntil === "" || licence.validUntil >= today) ? "Licensed" : "Expired";
};

export const loadLicenceMarks = async (recordCode: string, today = todayIso()): Promise<Map<string, LicenceMark> | null> => {
  try {
    const [licences, chains] = await Promise.all([approvedLicences(), loadRowChains(recordCode)]);
    return new Map([...chains].map(([current, chain]) => [current, markOf(licences.filter((licence) => chain.includes(licence.rowId)), today)]));
  } catch {
    return null;
  }
};

export const loadLicensedRowIds = async (recordCode: string): Promise<Set<string> | null> => {
  const marks = await loadLicenceMarks(recordCode);
  return marks && new Set([...marks].filter(([, mark]) => mark !== "Not licensed").map(([current]) => current));
};
