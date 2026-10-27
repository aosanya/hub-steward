import type { InstructionPart } from "./agentApi";

const agencySources = ["agency", "seat_description", "objectives", "values_rules", "work_item_instructions"];
const fineTuningSource = "fine_tuning";

export type Preview = { agency: string[]; own: string[] };

export const isAgencyPart = (part: InstructionPart) => agencySources.includes(part.source);

export const agencyPartsOf = (parts: InstructionPart[]) => parts.filter((part) => isAgencyPart(part) && part.text);

export const assemblePreview = (parts: InstructionPart[], useAgency: boolean, fineTuning: string): Preview => ({
  agency: useAgency ? agencyPartsOf(parts).map((part) => part.text) : [],
  own: parts
    .filter((part) => !isAgencyPart(part) && part.source !== fineTuningSource && part.text)
    .map((part) => part.text)
    .concat(fineTuning.split("\n").filter(Boolean)),
});
