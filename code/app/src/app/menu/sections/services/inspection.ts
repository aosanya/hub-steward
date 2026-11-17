import { dayWords } from "../../../../shared/ui/days";
import { text, type Item } from "../staff/staffData";

export const inspectTool = "forms_submission_inspect";

export const inspectPermission = "application.inspect";

export const inspectionWords = "Inspection";

export const inspectAgainWords = "Inspect again";

export const noteWords = "Note";

export const recordLabel = "Record";

export type InspectionResult = "complies" | "does_not_comply" | "needs_more";

export const inspectionResults: { value: InspectionResult; label: string }[] = [
  { value: "complies", label: "Complies" },
  { value: "does_not_comply", label: "Does not comply" },
  { value: "needs_more", label: "Needs more" },
];

export const needsNote = (result: InspectionResult) => result !== "complies";

const resultWordsOf = (result: string) => inspectionResults.find((one) => one.value === result)?.label ?? "";

export const inspectionLineOf = (sent: Item) => {
  const result = resultWordsOf(text(sent, "inspection_result"));
  if (result === "") return "";
  const heading = `${result} ${dayWords(text(sent, "inspected_at"))}`.trim();
  const note = text(sent, "inspection_note");
  return note === "" ? heading : `${heading}: ${note}`;
};
