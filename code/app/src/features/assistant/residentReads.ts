import type { ChatAbout } from "../../app/chatAbout";

export const residentReadScopes: Record<string, string> = {
  accounting_bill_list: "actor_id",
  digitaltwin_tenure_list: "holder_actor_id",
  forms_submission_list_of_person: "member_id",
  forms_catalog_raised_item_list_of_person: "raised_by",
};

export const residentReadNames = Object.keys(residentReadScopes);

export const residentStepWords: Record<string, string> = {
  accounting_bill_list: "Reading the resident's bills",
  digitaltwin_tenure_list: "Reading the resident's holdings",
  forms_submission_list_of_person: "Reading the resident's applications",
  forms_catalog_raised_item_list_of_person: "Reading what the resident raised",
};

export const residentReadsWords =
  "For this resident you can read their bills, holdings, applications and raised items with the tools you are given; they already cover only this resident, so never ask for an id. Say you cannot read anything else about them.";

export const residentNamesFor = (about: ChatAbout | null) => (about?.kind === "resident" ? residentReadNames : []);

export const scopedToResident = (about: ChatAbout | null, name: string, args: Record<string, unknown>) => {
  const scope = residentReadScopes[name];
  return about && scope ? { ...args, [scope]: about.id } : args;
};

export const withoutScope = (name: string, properties: Record<string, unknown>, required: unknown[]) => {
  const scope = residentReadScopes[name];
  return {
    properties: Object.fromEntries(Object.entries(properties).filter(([key]) => key !== scope)),
    required: required.filter((key) => key !== scope),
  };
};
