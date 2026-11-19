import { refusalText, wakalaFetch } from "../entry/api";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { isRefusal, reportRefused } from "../../shared/wakala/mcp";

export type PollChoice = { id: string; label: string; position: number };

export type OpenPoll = { id: string; question: string; answered: boolean; choices: PollChoice[] };

export type CountChoice = { choiceId: string; label: string; votes: number };

export type PollCount = { answered: number; choices: CountChoice[] };

export const sendFailedWords = "Your answer could not be sent. Try again.";

const pollsPath = (rest: string) => `/instances/${encodeURIComponent(openAgencyId())}/voting/polls${rest}`;

const text = (value: unknown) => (typeof value === "string" ? value : "");

const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const choiceOf = (raw: any): PollChoice => ({ id: text(raw?.id), label: text(raw?.label), position: number(raw?.position) });

const pollOf = (raw: any): OpenPoll => ({
  id: text(raw?.id),
  question: text(raw?.question),
  answered: raw?.answered === true,
  choices: (Array.isArray(raw?.choices) ? raw.choices : []).map(choiceOf).sort((a: PollChoice, b: PollChoice) => a.position - b.position),
});

export const listOpenPolls = async (): Promise<OpenPoll[]> => {
  const res = await wakalaFetch(pollsPath("/open"), { method: "GET" });
  if (res.status === 401) reportRefused();
  if (!res.ok) throw new Error(`open questions answered ${res.status}`);
  const body = await res.json();
  return (Array.isArray(body) ? body : []).map(pollOf);
};

export const answerPoll = async (pollId: string, choiceId: string): Promise<void> => {
  const res = await wakalaFetch(pollsPath(`/${encodeURIComponent(pollId)}/answers`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ votes: { [choiceId]: 1 } }),
  });
  if (res.status === 401) reportRefused();
  if (!res.ok) throw new Error((await refusalText(res)) || sendFailedWords);
};

export const readCount = async (pollId: string): Promise<PollCount | null> => {
  const res = await wakalaFetch(pollsPath(`/${encodeURIComponent(pollId)}/count`), { method: "GET" });
  if (isRefusal(res.status)) return null;
  if (!res.ok) throw new Error(`the count answered ${res.status}`);
  const body = await res.json();
  return {
    answered: number(body?.answered),
    choices: (Array.isArray(body?.choices) ? body.choices : [])
      .sort((a: any, b: any) => number(a?.position) - number(b?.position))
      .map((raw: any) => ({ choiceId: text(raw?.choice_id), label: text(raw?.label), votes: number(raw?.votes) })),
  };
};

export type NewQuestion = { question: string; choices: string[]; groupId: string; days: number };

export const askFailedWords = "Your question could not be opened. Try again.";

const dayMilliseconds = 86_400_000;

const postJson = async (path: string, body: unknown): Promise<Response> => {
  const res = await wakalaFetch(pollsPath(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) reportRefused();
  if (!res.ok) throw new Error((await refusalText(res)) || askFailedWords);
  return res;
};

export const openQuestion = async (input: NewQuestion): Promise<string> => {
  const opens = new Date();
  const closes = new Date(opens.getTime() + input.days * dayMilliseconds);
  const created = await postJson("", {
    question: input.question,
    mode: "one",
    per_group: "once",
    group_ids: [input.groupId],
    opens_at: opens.toISOString(),
    closes_at: closes.toISOString(),
  });
  const pollId = text((await created.json())?.id);
  for (const label of input.choices) await postJson(`/${encodeURIComponent(pollId)}/choices`, { label });
  return pollId;
};
