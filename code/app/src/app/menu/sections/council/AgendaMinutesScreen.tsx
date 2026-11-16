import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuList } from "../../MenuList";
import { useBackToSection } from "../../useBackToSection";
import "../../menuWindow.css";
import { councilTools, homeEmpty, listOf, readMeetingArgs, text, type Agenda, type Item, type Minutes } from "./councilData";

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
  const view = useLoad(() => loadPapers(id), `agenda-minutes:${openAgencyId()}:${id}`);
  if (view.state !== "ready") return <LoadingLine />;
  const { items, minutes } = view.data;
  return (
    <>
      <SectionHeading>Agenda</SectionHeading>
      {items.length === 0 ? (
        <EmptyCard words="No agenda yet." />
      ) : (
        <Rows>
          {items.map((entry, at) => (
            <ListRow key={at} title={entry} />
          ))}
        </Rows>
      )}
      <SectionHeading>Minutes</SectionHeading>
      {minutes === "" ? (
        <EmptyCard words="No minutes yet." />
      ) : (
        <Rows>
          <ListRow title={minutes} />
        </Rows>
      )}
    </>
  );
}

export function AgendaMinutesScreen() {
  const back = useBackToSection();
  const [chosen, setChosen] = useState("");
  return (
    <Shell title={agendaMinutesTitle} titleUnder onBack={chosen ? () => setChosen("") : back.onBack} backLabel={chosen ? agendaMinutesTitle : back.backLabel}>
      <div className="mw" data-chosen={chosen ? "yes" : "no"}>
        <section className="mw-list" aria-label={agendaMinutesTitle}>
          <MenuList
            bare
            title={agendaMinutesTitle}
            tool={councilTools.meetingList}
            load={loadMeetings}
            fields={{ title: "name", meta: "date" }}
            empty={homeEmpty("No meetings yet.")}
            selectedId={chosen}
            onChoose={setChosen}
          />
        </section>
        {chosen ? (
          <section className="mw-detail" aria-label={agendaMinutesTitle}>
            <Papers id={chosen} />
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
