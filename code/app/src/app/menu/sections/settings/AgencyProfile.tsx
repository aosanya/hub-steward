import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { loadFailedWords } from "../../MenuDetail";
import { refusalWords } from "../../MenuEditForm";
import { useBackToSection } from "../../useBackToSection";
import { PageFrame } from "../../PageFrame";
import { Section } from "../../../../shared/ui/Section";
import { useLanguagesEdit, type Languages } from "./LanguagesEdit";
import { useOwner } from "./useOwner";

type Profile = { name: string; languages: Languages };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadProfile = async (): Promise<Profile> => {
  const [agency, languages] = await Promise.all([callTool("", "agency_get_agency"), callTool("", "instance_get_languages")]);
  const read = (languages ?? {}) as Record<string, unknown>;
  return {
    name: String((agency as { name?: unknown } | null)?.name ?? ""),
    languages: {
      studioDefault: textOf(read.studio_default),
      content: Array.isArray(read.content) ? read.content.filter((code): code is string => typeof code === "string") : [],
      contentDefault: textOf(read.content_default),
    },
  };
};

export function AgencyProfile() {
  const back = useBackToSection();
  const word = useWord();
  const [saved, setSaved] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState("");
  const owner = useOwner();
  const view = useLoad(loadProfile, `agency-profile:${openAgencyId()}:${saved}`);
  const empty = { content: [], studioDefault: "", contentDefault: "" } as Languages;
  const languages = useLanguagesEdit(view.state === "ready" ? view.data.languages : empty, () => setSaved(saved + 1));
  const save = async () => {
    try {
      await callTool("", "instance_rename", { name: draft });
      setRefused("");
      setDraft(null);
      setSaved(saved + 1);
    } catch (error) {
      setRefused(refusalWords(error));
    }
  };
  const nameRows = (name: string) => [
    <ListRow key="name" title="Name" meta={name} />,
    ...(draft === null
      ? []
      : [
          <div key="rename" className="sec-tools">
            <Field label="Name" value={draft} onChange={(event) => setDraft(event.target.value)} />
            <Button kind="primary" disabled={draft.trim() === ""} onClick={save}>Save</Button>
            <Button kind="quiet" onClick={() => setDraft(null)}>Cancel</Button>
          </div>,
        ]),
  ];
  const renameAct =
    owner && draft === null && view.state === "ready" ? (
      <button type="button" className="sec-act" onClick={() => setDraft(view.data.name)}>Rename</button>
    ) : undefined;
  return (
    <Shell title={word("Agency Profile")} onBack={back.onBack} backLabel={back.backLabel}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} /> : null}
      {view.state === "ready" ? (
        <PageFrame title={word("Agency Profile")}>
          <Section word="Name" plain rows={nameRows(view.data.name)} foot={renameAct} />
          <Section
            word="Languages"
            plain
            rows={[<ListRow key="languages" title="Languages" meta={view.data.languages.content.join(", ")} />, ...(languages.form ? [languages.form] : [])]}
            foot={owner ? languages.act : undefined}
          />
          {refused ? <LoadFailed words={refused} /> : null}
        </PageFrame>
      ) : null}
    </Shell>
  );
}
