import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { councilTools, homeEmpty, listOf, noneYet, readMeetingArgs, text, type Item } from "./councilData";

export const meetingsTitle = "Meetings";

const meetingOf = (meeting: Item | null | undefined) => ({
  id: text(meeting, "id"),
  name: text(meeting, "name"),
  date: text(meeting, "date"),
  place: text(meeting, "place"),
  committee: text(meeting, "committee"),
});

const loadMeetings = async () =>
  (await listOf(councilTools.meetingList)).map((item) => {
    const meeting = meetingOf(item);
    return { ...meeting, meta: [meeting.date, meeting.place].filter((part) => part !== "").join(" · ") };
  });

const loadMeeting = async (id: string) => {
  const reply = (await callTool("", councilTools.meetingRead, readMeetingArgs(id))) as Item | null;
  return meetingOf((reply?.item ?? reply) as Item | null);
};

export function MeetingsScreen() {
  const word = useWord("council");
  const title = word(meetingsTitle);
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: councilTools.meetingList, load: loadMeetings, fields: { title: "name", meta: "meta" }, empty: homeEmpty(noneYet(word, meetingsTitle, "No meetings yet.")) }}
      detail={{ tool: councilTools.meetingRead, load: loadMeeting, fields: { Name: "name", Date: "date", Place: "place", Committee: "committee" }, status: "status" }}
    />
  );
}
