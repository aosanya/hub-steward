import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { loadFormList } from "../../formList";
import { loadRecordRowsHeldBy, type RecordRow } from "../../liveRecordRows";
import { servicesPaths } from "../services/paths";
import { ApplicationSheet } from "./ApplicationSheet";
import { ChooseSheet } from "./ChooseSheet";
import { SectionAct } from "./SectionAct";
import { useOpenSection } from "./personSections";
import { useOpenFromPanel } from "./useOpenFromPanel";
import { loadApplications } from "./applicationRows";
import { businessesMetaPrompts, businessesRecordCode, businessesTitlePrompt } from "./BusinessesScreen";
import { informalTradersMetaPrompts, informalTradersRecordCode, informalTradersTitlePrompt } from "./InformalTradersScreen";

const startTitle = "Start an application";

function ApplicationFlow({ personId, onClose, onFiled }: { personId: string; onClose: () => void; onFiled: () => void }) {
  const [formId, setFormId] = useState("");
  if (formId) return <ApplicationSheet title={startTitle} formId={formId} personId={personId} onClose={onClose} onFiled={onFiled} />;
  return <ChooseSheet title={startTitle} loadKey="person-application-forms" load={loadFormList} onClose={onClose} onChoose={async (chosen) => setFormId(chosen)} />;
}

export function PersonApplications({ id, full }: { id: string; full?: boolean }) {
  const opens = useOpenSection(id, "applications");
  const open = useOpenFromPanel();
  const word = useWord("forms");
  const [version, setVersion] = useState(0);
  const view = useLoad(loadApplications(id), `person-applications:${openAgencyId()}:${id}:${version}`);
  if (view.state === "error") return null;
  const applications = view.state === "ready" ? view.data : [];
  const act = <SectionAct permission="application.file" act={startTitle} sheet={(close) => <ApplicationFlow personId={id} onClose={close} onFiled={() => setVersion((was) => was + 1)} />} />;
  return (
    <>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" ? (
        <Section
          icon="document"
          word={word("Applications")}
          full={full}
          opens={opens}
          foot={act}
          empty={{ words: "No applications yet." }}
          rows={applications.map((application) => (
            <ListRow key={application.key} title={application.title} meta={`Sent ${dayWords(application.sentAt)}`} onClick={() => open(servicesPaths.application.path({ id: application.key }))} end="›" />
          ))}
        />
      ) : null}
    </>
  );
}

const holdings = [
  { heading: "Businesses", recordCode: businessesRecordCode, titlePrompt: businessesTitlePrompt, metaPrompts: businessesMetaPrompts },
  { heading: "Informal traders", recordCode: informalTradersRecordCode, titlePrompt: informalTradersTitlePrompt, metaPrompts: informalTradersMetaPrompts },
];

const loadHeldRows = (holding: (typeof holdings)[number], actorId: string) => async (): Promise<RecordRow[]> =>
  loadRecordRowsHeldBy(holding.recordCode, holding.titlePrompt, holding.metaPrompts, actorId);

function PersonHeld({ holding, id }: { holding: (typeof holdings)[number]; id: string }) {
  const view = useLoad(loadHeldRows(holding, id), `person-held:${openAgencyId()}:${holding.recordCode}:${id}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return (
    <>
      <SectionHeading>{holding.heading}</SectionHeading>
      <Rows>
        {view.data.map((row) => (
          <ListRow key={row.id} title={row.title} meta={row.meta} />
        ))}
      </Rows>
    </>
  );
}

export function PersonRecords({ id }: { id: string }) {
  return (
    <>
      {holdings.map((holding) => (
        <PersonHeld key={holding.recordCode} holding={holding} id={id} />
      ))}
    </>
  );
}
