import { detailsOf, holdingFields, holdingRecordCode, readRegisterAnswers, readRegisterDetails, type RegisterDetail } from "../../registerDetails";
import { joined } from "./records";

export type OwnAnswer = { prompt: string; answer: string };

export type HoldingDetails = { switchedOn: RegisterDetail[]; isOn: (prompt: string) => boolean };

export const loadHoldingDetails = async (): Promise<HoldingDetails> => {
  const switchedOn = detailsOf(holdingFields, await readRegisterDetails(holdingRecordCode)).filter((detail) => detail.on);
  return { switchedOn, isOn: (prompt) => switchedOn.some((detail) => detail.prompt === prompt) };
};

export const loadOwnAnswers = async (details: HoldingDetails, tenureId: string): Promise<OwnAnswer[]> => {
  const answers = await readRegisterAnswers(holdingRecordCode, tenureId);
  return details.switchedOn
    .filter((detail) => detail.own)
    .map((detail) => ({ prompt: detail.prompt, answer: answers[detail.prompt] ?? "" }))
    .filter((own) => own.answer !== "");
};

const ownAnswerWords = (own: OwnAnswer) => `${own.prompt}: ${own.answer}`;

export const withOwnAnswers = (meta: string[], own: OwnAnswer[]) => joined([...meta, ...own.map(ownAnswerWords)]);
