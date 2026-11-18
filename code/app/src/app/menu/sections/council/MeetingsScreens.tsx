import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { CouncilPage, DetailCard } from "./CouncilPage";
import { MeetingPapers } from "./MeetingPapers";
import { councilTools, homeEmpty, listOf, noneYet, text, type Item } from "./councilData";
import { loadMeeting, meetingOf } from "./councilRecords";

export const meetingsTitle = "Meetings";

const loadMeetings = async () =>
  (await listOf(councilTools.meetingList)).map((item) => {
    const meeting = meetingOf(item);
    return { ...meeting, meta: [meeting.date, meeting.place].filter((part) => part !== "").join(" · ") };
  });

function MeetingPage({ meeting }: { meeting: Item }) {
  const line = [text(meeting, "date"), text(meeting, "place")].filter((part) => part !== "").join(" · ");
  return (
    <CouncilPage name={text(meeting, "name")} line={line}>
      <DetailCard word="Meeting detail" item={meeting} kind="meetings" rows={[["Name", text(meeting, "name")], ["Date", text(meeting, "date")], ["Place", text(meeting, "place")], ["Committee", text(meeting, "committee")]]} />
      <MeetingPapers id={text(meeting, "id")} withResolutions />
    </CouncilPage>
  );
}

export function MeetingsScreen() {
  const word = useWord("council");
  const title = word(meetingsTitle);
  const [version] = useState(0);
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={search.get("id") ?? undefined}
      listKey={version}
      detailKey={version}
      list={{ title, tool: councilTools.meetingList, load: loadMeetings, fields: { title: "name", meta: "meta" }, empty: homeEmpty(noneYet(word, meetingsTitle, "No meetings yet.")) }}
      detail={{ tool: councilTools.meetingRead, load: loadMeeting, fields: {}, status: "", extra: (meeting) => <MeetingPage meeting={meeting} /> }}
    />
  );
}
