import { listOf, text, type Item } from "../staff/staffData";
import { callTool } from "../../../../shared/wakala/mcp";
import { areaGroups } from "../../areaGroups";

export const roundsTools = { forms: "forms_form_list", reach: "forms_propagation_list", sends: "forms_submission_list", groups: "actor_list_groups" };

type Round = { id: string; reachedGroups: string[]; senders: Map<string, Set<string>> };

const formOf = (row: Item) => ((row.form ?? row) as Item);

const roundsOf = async (): Promise<Item[]> => {
  const reply = (await callTool("", roundsTools.forms)) as { rows?: Item[]; items?: Item[] } | null;
  return (reply?.rows ?? reply?.items ?? []).map(formOf);
};

const askedThisYear = (form: Item) => text(form, "published_at").startsWith(String(new Date().getFullYear()));

const sendersByGroup = (sends: Item[]) => {
  const senders = new Map<string, Set<string>>();
  sends.forEach((send) => {
    const group = text(send, "chapter_id");
    senders.set(group, (senders.get(group) ?? new Set()).add(text(send, "member_id")));
  });
  return senders;
};

const readRound = async (form: Item): Promise<Round> => {
  const [reached, sends] = await Promise.all([listOf(roundsTools.reach, { form_id: text(form, "id") }), listOf(roundsTools.sends, { form_id: text(form, "id") })]);
  return { id: text(form, "id"), reachedGroups: reached.map((row) => text(row, "chapter_id")), senders: sendersByGroup(sends) };
};

const populationOf = async (groupId: string) => {
  const reply = (await callTool("", "actor_get_group_population", { group_id: groupId }).catch(() => null)) as { population?: unknown } | null;
  return typeof reply?.population === "number" ? reply.population : null;
};

export type NeighbourhoodRow = { id: string; name: string; meta: string; asked: string; answered: string; population: string; share: string };

const shareOf = (answered: number, population: number | null) => (population ? `${Math.round((answered / population) * 100)}%` : "");

const rowOf = (group: Item, rounds: Round[], population: number | null): NeighbourhoodRow => {
  const id = text(group, "id");
  const asked = rounds.filter((round) => round.reachedGroups.includes(id)).length;
  const members = new Set(rounds.flatMap((round) => [...(round.senders.get(id) ?? [])]));
  const share = shareOf(members.size, population);
  const outOf = population === null ? "" : ` of ${population}`;
  return {
    id,
    name: text(group, "name"),
    meta: `Asked ${asked} · Answered ${members.size}${outOf}${share ? ` · ${share}` : ""}`,
    asked: String(asked),
    answered: String(members.size),
    population: population === null ? "" : String(population),
    share,
  };
};

export const loadNeighbourhoodRows = async (): Promise<NeighbourhoodRow[]> => {
  const [neighbourhoods, forms] = await Promise.all([areaGroups(), roundsOf()]);
  if (neighbourhoods.length === 0) return [];
  const rounds = await Promise.all(forms.filter(askedThisYear).map(readRound));
  const populations = await Promise.all(neighbourhoods.map((group) => populationOf(text(group, "id"))));
  return neighbourhoods.map((group, index) => rowOf(group, rounds, populations[index]));
};
