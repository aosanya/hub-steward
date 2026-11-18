import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { ChatAboutMeeting } from "./ChatAboutCouncil";
import { CouncilPage } from "./CouncilPage";
import { MeetingPapers } from "./MeetingPapers";
import { councilTools, homeEmpty, listOf, noneYet, text, type Item } from "./councilData";
import { loadMeeting } from "./councilRecords";

export const agendaMinutesTitle = "Agendas & Minutes";

const loadMeetings = () => listOf(councilTools.meetingList);

function PapersPage({ meeting }: { meeting: Item }) {
  return (
    <CouncilPage name={text(meeting, "name")} line={text(meeting, "date")}>
      <ChatAboutMeeting meeting={meeting} home="agendas" />
      <MeetingPapers id={text(meeting, "id")} />
    </CouncilPage>
  );
}

export function AgendaMinutesScreen() {
  const word = useWord("council");
  const title = word(agendaMinutesTitle);
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={search.get("id") ?? undefined}
      list={{ title, tool: councilTools.meetingList, load: loadMeetings, fields: { title: "name", meta: "date" }, empty: homeEmpty(noneYet(word, "Meetings", "No meetings yet.")) }}
      detail={{ tool: councilTools.meetingRead, load: loadMeeting, fields: {}, status: "", extra: (meeting) => <PapersPage meeting={meeting} /> }}
    />
  );
}
