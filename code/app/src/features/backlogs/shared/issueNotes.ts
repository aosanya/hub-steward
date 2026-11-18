export type NoteKind = "person" | "worker";

export type IssueNote = { id: string; author: string; kind: NoteKind; text: string; links: string[]; at: string; automatic: boolean };

export type NoteLink = { label: string; href?: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const noteOf = (raw: any): IssueNote => ({
  id: text(raw?.id),
  author: text(raw?.author_id),
  kind: raw?.kind === "worker" ? "worker" : "person",
  text: text(raw?.text),
  links: Array.isArray(raw?.links) ? raw.links.filter((link: unknown) => typeof link === "string" && link.trim() !== "") : [],
  at: text(raw?.created_at),
  automatic: raw?.automatic === true,
});

const web = /^https?:\/\//;

export const linkOf = (raw: string): NoteLink => {
  const words = raw.trim().split(/\s+/);
  const last = words[words.length - 1];
  if (!web.test(last)) return { label: raw.trim() };
  const label = words.slice(0, -1).join(" ");
  return { label: label || last, href: last };
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const twoDigits = (n: number) => String(n).padStart(2, "0");

export const noteTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getDate()} ${months[date.getMonth()]}, ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
};

const idPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export const unnamedHolder = "someone no longer listed";

export const namedText = (words: string, names: Map<string, string>) => words.replace(idPattern, (id) => names.get(id) ?? names.get(id.toLowerCase()) ?? unnamedHolder);

const assigneeEntry = /^Assignee\b/;

export const shownText = (note: IssueNote, names: Map<string, string>) => (note.automatic && assigneeEntry.test(note.text) ? namedText(note.text, names) : note.text);
