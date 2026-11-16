import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuEditForm } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { councilTools, homeEmpty, listOf, manageCouncil, noneYet, readMeetingArgs, text, type Agenda, type Item, type Minutes } from "./councilData";

export const agendaMinutesTitle = "Agendas & Minutes";

const readOrNone = async (tool: string, id: string) => {
  try {
    const reply = (await callTool("", tool, readMeetingArgs(id))) as { item?: unknown } | null;
    return (reply?.item ?? reply) as Partial<Agenda & Minutes> | null;
  } catch {
    return null;
  }
};

const loadPapers = async (id: string) => {
  const [agenda, minutes] = await Promise.all([readOrNone(councilTools.agendaRead, id), readOrNone(councilTools.minutesRead, id)]);
  return { items: (agenda?.items ?? []).filter((entry) => typeof entry === "string" && entry !== ""), minutes: text(minutes as Item | null, "text") };
};

const loadMeetings = () => listOf(councilTools.meetingList);

function Papers({ id }: { id: string }) {
  const word = useWord("council");
  const [version, setVersion] = useState(0);
  const view = useLoad(() => loadPapers(id), `agenda-minutes:${openAgencyId()}:${id}:${version}`);
  const reload = () => setVersion((was) => was + 1);
  if (view.state !== "ready") return <LoadingLine />;
  const { items, minutes } = view.data;
  return (
    <>
      <div role="group" aria-label="Agenda">
        <SectionHeading>{word("Agenda")}</SectionHeading>
        {items.length === 0 ? (
          <EmptyCard words={noneYet(word, "Agenda", "No agenda yet.")} />
        ) : (
          <Rows>
            {items.map((entry, at) => (
              <ListRow key={at} title={entry} />
            ))}
          </Rows>
        )}
        <MenuEditForm item={{ items }} id={id} idArg="meetingID" tool={councilTools.agendaSet} permission={manageCouncil} fields={[{ label: "Agenda items, one per line", key: "items", kind: "lines" }]} onSaved={reload} />
      </div>
      <div role="group" aria-label="Minutes">
        <SectionHeading>{word("Minutes")}</SectionHeading>
        {minutes === "" ? (
          <EmptyCard words={noneYet(word, "Minutes", "No minutes yet.")} />
        ) : (
          <Rows>
            <ListRow title={minutes} />
          </Rows>
        )}
        <MenuEditForm item={{ text: minutes }} id={id} idArg="meetingID" tool={councilTools.minutesSet} permission={manageCouncil} fields={[{ label: "Minutes text", key: "text", required: true }]} onSaved={reload} />
      </div>
    </>
  );
}

export function AgendaMinutesScreen() {
  const word = useWord("council");
  const title = word(agendaMinutesTitle);
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: councilTools.meetingList, load: loadMeetings, fields: { title: "name", meta: "date" }, empty: homeEmpty(noneYet(word, "Meetings", "No meetings yet.")) }}
      detail={{ tool: councilTools.meetingRead, load: async (id) => ({ id }), fields: {}, status: "status", extra: (meeting) => <Papers id={text(meeting, "id")} /> }}
    />
  );
}
