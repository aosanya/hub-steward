import { useState } from "react";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { councilTools, homeEmpty, listOf, manageCouncil, noneYet, readMeetingArgs, text, type Item } from "./councilData";

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

const editFields: EditField[] = [
  { label: "Name", key: "name", required: true },
  { label: "Date", key: "date", kind: "date", required: true },
  { label: "Place", key: "place" },
  { label: "Committee", key: "committee" },
];

export function MeetingsScreen() {
  const word = useWord("council");
  const title = word(meetingsTitle);
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={title}
      listKey={version}
      detailKey={version}
      list={{ title, tool: councilTools.meetingList, load: loadMeetings, fields: { title: "name", meta: "meta" }, empty: homeEmpty(noneYet(word, meetingsTitle, "No meetings yet.")) }}
      detail={{ tool: councilTools.meetingRead, load: loadMeeting, fields: { Name: "name", Date: "date", Place: "place", Committee: "committee" },
        status: "status",
        extra: (meeting) => (
          <MenuEditForm
            item={meeting}
            id={text(meeting, "id")}
            idArg="meetingID"
            tool={councilTools.meetingUpdate}
            permission={manageCouncil}
            fields={editFields}
            keep={["name", "date", "place", "committee"]}
            readAgain={() => loadMeeting(text(meeting, "id"))}
            onSaved={() => setVersion((was) => was + 1)}
          />
        ),
      }}
    />
  );
}
