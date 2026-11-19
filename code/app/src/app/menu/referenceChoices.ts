import { itemsOf } from "../../features/backlogs";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";
import { areaGroups } from "./areaGroups";
import { resolveRecordCode } from "./liveRecordRows";
import { loadRoleKinds, openRoleChoices } from "./roleKinds";
import { namedPersonOf } from "./sections/residents/personName";
import { unnamedPerson } from "./sections/settings/personLabel";

type Item = Record<string, unknown>;

const listPeople = async () => (await callTool("", "actor_list_actors").then(itemsOf)) as Item[];

const personPrefix = "person:";

const bodyPrefix = "body:";

const listGroups = async () => (await callTool("", "actor_list_groups").then(itemsOf)) as Item[];

const nameOfGroup = (group: Item) => (typeof group.name === "string" ? group.name : "");

export const loadHolderChoices = async (): Promise<Choice[]> => {
  const [people, groups] = await Promise.all([listPeople(), listGroups().catch((): Item[] => [])]);
  const persons = people.flatMap((person) => (typeof person.id === "string" && person.id !== "" ? [{ value: `${personPrefix}${person.id}`, label: namedPersonOf(person) || unnamedPerson }] : []));
  const bodies = groups.map(nameOfGroup).filter((name) => name !== "").map((name) => ({ value: `${bodyPrefix}${name}`, label: name }));
  return [...persons, ...bodies];
};

export const holderArgs = (value: string, choices: Choice[]) => {
  const label = choices.find((choice) => choice.value === value)?.label ?? "";
  return value.startsWith(personPrefix) ? { holder: label, holder_actor_id: value.slice(personPrefix.length) } : { holder: label };
};

export const loadPersonIdChoices = async (): Promise<Choice[]> =>
  (await listPeople()).flatMap((person) => (typeof person.id === "string" && person.id !== "" ? [{ value: person.id, label: namedPersonOf(person) || unnamedPerson }] : []));

const wordOf = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const accountLabelOf = (account: Item) => {
  const name = wordOf(account.name);
  if (name !== "") return name;
  return [capitalised(wordOf(account.category)), wordOf(account.code)].filter((word) => word !== "").join(" ");
};

export const loadAccountChoices = async (): Promise<Choice[]> =>
  ((await callTool("", "accounting_account_list").then(itemsOf)) as Item[]).flatMap((account) => {
    const label = accountLabelOf(account);
    return wordOf(account.id) !== "" && label !== "" ? [{ value: wordOf(account.id), label }] : [];
  });

const loadRowChoices = async (recordCode: string, titlePrompt: string): Promise<Choice[]> => {
  const code = await resolveRecordCode(recordCode);
  const rows = (await callTool("", "agency_list_live_record_rows", { record_code: code }).then(itemsOf)) as Item[];
  return rows.flatMap((row) => {
    const title = wordOf((row.answers as Item | undefined)?.[titlePrompt]);
    return wordOf(row.id) !== "" && title !== "" ? [{ value: wordOf(row.id), label: title }] : [];
  });
};

export const loadBusinessChoices = () => loadRowChoices("RC-1", "Trading name");

export const loadTraderChoices = () => loadRowChoices("RC-2", "Name or alias");

export const loadNeighbourhoodChoices = async (): Promise<Choice[]> =>
  (await areaGroups()).flatMap((group) => (wordOf(group.id) !== "" && nameOfGroup(group) !== "" ? [{ value: wordOf(group.id), label: nameOfGroup(group) }] : []));

export const loadRoleKindChoices = async (): Promise<Choice[]> => openRoleChoices(await loadRoleKinds());

export type Reference = "business" | "trader" | "neighbourhood" | "roleKind";

export const loadReferenceChoices = (reference: Reference): Promise<Choice[]> =>
  ({ business: loadBusinessChoices, trader: loadTraderChoices, neighbourhood: loadNeighbourhoodChoices, roleKind: loadRoleKindChoices })[reference]();
