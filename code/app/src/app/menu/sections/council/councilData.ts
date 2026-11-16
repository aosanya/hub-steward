import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";

export type Item = Record<string, unknown>;

export type Outcome = "adopted" | "rejected" | "deferred";

export type Meeting = { id: string; name: string; date: string; place: string; committee: string };

export type Agenda = { meeting_id: string; items: string[] };

export type Minutes = { meeting_id: string; text: string };

export type Resolution = { id: string; meeting_id: string; title: string; date: string; outcome: Outcome };

export type Bylaw = { id: string; title: string; year: number; text: string };

export type MeetingListArgs = { committee?: string };

export type ResolutionListArgs = { meeting_id?: string; outcome?: Outcome };

export type BylawListArgs = { year?: number };

export const councilTools = {
  meetingCreate: "council_meeting_create",
  meetingList: "council_meeting_list",
  meetingRead: "council_meeting_read",
  agendaSet: "council_agenda_set",
  agendaRead: "council_agenda_read",
  minutesSet: "council_minutes_set",
  minutesRead: "council_minutes_read",
  resolutionCreate: "council_resolution_create",
  resolutionList: "council_resolution_list",
  resolutionRead: "council_resolution_read",
  bylawCreate: "council_bylaw_create",
  bylawList: "council_bylaw_list",
  bylawRead: "council_bylaw_read",
} as const;

export const readMeetingArgs = (id: string) => ({ meetingID: id });

export const readResolutionArgs = (id: string) => ({ resolutionID: id });

export const readBylawArgs = (id: string) => ({ bylawID: id });

export const text = (item: Item | null | undefined, key: string) => {
  const value = item?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export const listOf = async (tool: string, args?: Record<string, unknown>) => itemsOf(await callTool("", tool, args)) as Item[];

export const homeEmpty = (words: string) => ({ words, act: "Home", to: agencyHomePath(openAgencyId()) });
