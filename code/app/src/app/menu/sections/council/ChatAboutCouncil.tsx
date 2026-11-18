import { useChatAboutSubject } from "../residents/SubjectChat";
import { text, type Item } from "./councilData";
import { councilPaths } from "./paths";

type Home = "meetings" | "agendas" | "resolutions" | "bylaws" | "committees";

const backTo = (home: Home, id: string) => `${councilPaths[home].path()}?id=${id}`;

export function ChatAboutMeeting({ meeting, home = "meetings" }: { meeting: Item; home?: "meetings" | "agendas" }) {
  useChatAboutSubject({ kind: "meeting", id: text(meeting, "id"), name: text(meeting, "name") }, backTo(home, text(meeting, "id")));
  return null;
}

export function ChatAboutResolution({ resolution }: { resolution: Item }) {
  useChatAboutSubject({ kind: "resolution", id: text(resolution, "id"), name: text(resolution, "title"), extra: { meeting: text(resolution, "meetingId") } }, backTo("resolutions", text(resolution, "id")));
  return null;
}

export function ChatAboutBylaw({ bylaw }: { bylaw: Item }) {
  useChatAboutSubject({ kind: "bylaw", id: text(bylaw, "id"), name: text(bylaw, "title") }, backTo("bylaws", text(bylaw, "id")));
  return null;
}

export function ChatAboutCommittee({ committee }: { committee: Item }) {
  useChatAboutSubject({ kind: "committee", id: text(committee, "id"), name: text(committee, "name") }, backTo("committees", text(committee, "id")));
  return null;
}
