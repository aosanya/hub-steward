import type { ChatAbout } from "../../app/chatAbout";
import { residentReadsOnlyRule } from "./triager";

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

export const residentChoices = ["Bills", "Holdings", "Applications", "Wishes and issues"];

const choiceLines = residentChoices.map((choice) => `[[${choice}]]`).join(" ");

export const residentInvitation = (name: string) => `What would you like to see about ${name}? Tap one, or write your question.`;

export const residentPrompt = (about: ChatAbout) =>
  `You are the Hub Steward, talking with the owner about one resident, ${about.name}. Everything in this conversation is about ${about.name}: answer about them, and never ask the owner what they want to find or offer search readings as choices. Answer briefly in the language the owner writes in. Bills means accounting_bill_list, holdings digitaltwin_tenure_list, applications forms_submission_list_of_person, and wishes and issues forms_catalog_raised_item_list_of_person; call the one the owner asks for at once and never name a fact you did not read from a tool. When the owner only greets you or writes something vague, call no tool: answer in one short sentence, exactly "${residentInvitation(about.name)}", and give the choices, each on its own line, as ${choiceLines}. When the owner asks generally about the resident ("tell me about him", "what do you know", "summary"), call all four reads at once and answer with a short overview: for each read its count and the most recent item, in plain words, and for a read with nothing on file say there is nothing on file for it; then give the choices as ${choiceLines} for detail. Never write the same reply twice in a row: if you have just given the invitation, answer the next message from the reads instead. ${residentReadsOnlyRule}`;
