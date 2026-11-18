import { callTool } from "../../../../shared/wakala/mcp";
import type { EditField } from "../../MenuEditForm";
import { loadCommittee } from "./committeesData";
import { councilTools, listOf, manageCouncil, readBylawArgs, readMeetingArgs, readResolutionArgs, text, type Agenda, type Bylaw, type Item, type Minutes } from "./councilData";

export const outcomeWords = (outcome: string) => outcome.charAt(0).toUpperCase() + outcome.slice(1);

export const meetingOf = (meeting: Item | null | undefined) => ({
  id: text(meeting, "id"),
  name: text(meeting, "name"),
  date: text(meeting, "date"),
  place: text(meeting, "place"),
  committee: text(meeting, "committee"),
});

export const loadMeeting = async (id: string) => {
  const reply = (await callTool("", councilTools.meetingRead, readMeetingArgs(id))) as Item | null;
  return meetingOf((reply?.item ?? reply) as Item | null);
};

export const meetingName = async (meetingId: string) => {
  if (meetingId === "") return "";
  try {
    const reply = (await callTool("", councilTools.meetingRead, readMeetingArgs(meetingId))) as Item | null;
    return text((reply?.item ?? reply) as Item | null, "name");
  } catch {
    return "";
  }
};

export const loadResolution = async (id: string) => {
  const resolution = (await callTool("", councilTools.resolutionRead, readResolutionArgs(id))) as Item | null;
  return {
    id,
    title: text(resolution, "title"),
    date: text(resolution, "date"),
    outcome: text(resolution, "outcome"),
    outcomeWords: outcomeWords(text(resolution, "outcome")),
    meeting: await meetingName(text(resolution, "meeting_id")),
  };
};

export const loadBylaw = async (id: string): Promise<Item> => {
  const reply = (await callTool("", councilTools.bylawRead, readBylawArgs(id))) as { item?: Partial<Bylaw> } | Partial<Bylaw> | null;
  const bylaw = (reply && "item" in reply ? reply.item : reply) ?? {};
  return { id, title: text(bylaw, "title"), year: text(bylaw, "year"), text: text(bylaw, "text") };
};

const readOrNone = async (tool: string, id: string) => {
  try {
    const reply = (await callTool("", tool, readMeetingArgs(id))) as { item?: unknown } | null;
    return (reply?.item ?? reply) as Partial<Agenda & Minutes> | null;
  } catch {
    return null;
  }
};

export const loadPapers = async (id: string) => {
  const [agenda, minutes] = await Promise.all([readOrNone(councilTools.agendaRead, id), readOrNone(councilTools.minutesRead, id)]);
  return { items: (agenda?.items ?? []).filter((entry) => typeof entry === "string" && entry !== ""), minutes: text(minutes as Item | null, "text") };
};

export const loadMeetingResolutions = async (meetingId: string) =>
  (await listOf(councilTools.resolutionList, { meeting_id: meetingId })).map((resolution) => ({
    id: text(resolution, "id"),
    title: text(resolution, "title"),
    date: text(resolution, "date"),
    outcome: outcomeWords(text(resolution, "outcome")),
  }));

export type EditKind = "meetings" | "resolutions" | "bylaws" | "agenda" | "minutes" | "committees";

type Form = { tool: string; idArg: string; permission: string; fields: EditField[]; keep?: string[]; item: (loaded: Item) => Item };

export type CouncilEdit = { word: string; home: "meetings" | "agendas" | "resolutions" | "bylaws" | "committees"; load: (id: string) => Promise<Item>; nameOf: (loaded: Item) => string; form: Form };

const meetingFields: EditField[] = [
  { label: "Name", key: "name", required: true },
  { label: "Date", key: "date", kind: "date", required: true },
  { label: "Place", key: "place" },
  { label: "Committee", key: "committee" },
];

const resolutionFields: EditField[] = [
  { label: "Title", key: "title", required: true },
  { label: "Date", key: "date", kind: "date", required: true },
  { label: "Outcome", key: "outcome", required: true },
];

const bylawFields: EditField[] = [
  { label: "Title", key: "title", required: true },
  { label: "Year", key: "year", kind: "number", required: true },
  { label: "Text", key: "text", required: true },
];

const withMeeting = async (id: string) => ({ ...(await loadMeeting(id)), ...(await loadPapers(id)) });

const same = (loaded: Item) => loaded;

export const councilEdits: Record<EditKind, CouncilEdit> = {
  meetings: { word: "meeting", home: "meetings", load: loadMeeting, nameOf: (loaded) => text(loaded, "name"), form: { tool: councilTools.meetingUpdate, idArg: "meetingID", permission: manageCouncil, fields: meetingFields, keep: ["name", "date", "place", "committee"], item: same } },
  resolutions: { word: "resolution", home: "resolutions", load: loadResolution, nameOf: (loaded) => text(loaded, "title"), form: { tool: councilTools.resolutionUpdate, idArg: "resolutionID", permission: manageCouncil, fields: resolutionFields, keep: ["title", "date", "outcome"], item: same } },
  bylaws: { word: "bylaw", home: "bylaws", load: loadBylaw, nameOf: (loaded) => text(loaded, "title"), form: { tool: councilTools.bylawUpdate, idArg: "bylawID", permission: manageCouncil, fields: bylawFields, keep: ["title", "year", "text"], item: same } },
  agenda: { word: "agenda", home: "agendas", load: withMeeting, nameOf: (loaded) => text(loaded, "name"), form: { tool: councilTools.agendaSet, idArg: "meetingID", permission: manageCouncil, fields: [{ label: "Agenda items, one per line", key: "items", kind: "lines" }], item: (loaded) => ({ items: loaded.items }) } },
  minutes: { word: "minutes", home: "agendas", load: withMeeting, nameOf: (loaded) => text(loaded, "name"), form: { tool: councilTools.minutesSet, idArg: "meetingID", permission: manageCouncil, fields: [{ label: "Minutes text", key: "text", required: true }], item: (loaded) => ({ text: loaded.minutes }) } },
  committees: { word: "committee", home: "committees", load: loadCommittee, nameOf: (loaded) => text(loaded, "name"), form: { tool: "actor_edit_group", idArg: "group_id", permission: "group.manage", fields: [{ label: "Name", key: "name", required: true }], keep: ["NodeType", "AnchorLevelOverrideID"], item: same } },
};

export const isEditKind = (kind: string): kind is EditKind => kind in councilEdits;
