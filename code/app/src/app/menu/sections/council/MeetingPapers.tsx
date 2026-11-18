import { useNavigate } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { EditAct } from "./CouncilPage";
import { noneYet } from "./councilData";
import { loadMeetingResolutions, loadPapers } from "./councilRecords";
import { councilPaths } from "./paths";

export function AgendaCard({ id, items }: { id: string; items: string[] }) {
  const word = useWord("council");
  return (
    <Section
      word={word("Agenda")}
      icon="list"
      all
      foot={<EditAct kind="agenda" id={id} act="Edit agenda" />}
      empty={{ words: noneYet(word, "Agenda", "No agenda yet.") }}
      rows={items.map((entry, at) => (
        <ListRow key={at} title={entry} />
      ))}
    />
  );
}

export function MinutesCard({ id, minutes }: { id: string; minutes: string }) {
  const word = useWord("council");
  return <Section word={word("Minutes")} plain foot={<EditAct kind="minutes" id={id} act="Edit minutes" />} empty={{ words: noneYet(word, "Minutes", "No minutes yet.") }} rows={minutes === "" ? [] : [<ListRow key="minutes" title={minutes} />]} />;
}

export function MeetingPapers({ id, withResolutions = false }: { id: string; withResolutions?: boolean }) {
  const view = useLoad(async () => ({ papers: await loadPapers(id), resolutions: withResolutions ? await loadMeetingResolutions(id) : [] }), `meeting-papers:${openAgencyId()}:${id}:${withResolutions}`);
  const navigate = useNavigate();
  const word = useWord("council");
  if (view.state === "loading") return <LoadingLine />;
  if (view.state === "error") return <LoadFailed words="The papers could not be loaded." />;
  const { papers, resolutions } = view.data;
  return (
    <>
      <AgendaCard id={id} items={papers.items} />
      <MinutesCard id={id} minutes={papers.minutes} />
      {withResolutions ? (
        <Section
          word={word("Resolutions")}
          icon="document"
          rows={resolutions.map((resolution) => (
            <ListRow key={resolution.id} title={resolution.title} meta={resolution.date} status={resolution.outcome} onClick={() => navigate(`${councilPaths.resolutions.path()}?id=${resolution.id}`)} end="›" />
          ))}
        />
      ) : null}
    </>
  );
}
