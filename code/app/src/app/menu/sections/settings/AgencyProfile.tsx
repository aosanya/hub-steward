import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { loadFailedWords } from "../../MenuDetail";
import { refusalWords } from "../../MenuEditForm";
import { useBackToSection } from "../../useBackToSection";
import { LanguagesEdit, type Languages } from "./LanguagesEdit";
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
  return (
    <Shell title={word("Agency Profile")} titleUnder {...back}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} /> : null}
      {view.state === "ready" ? (
        <>
          <Rows>
            <ListRow title="Name" meta={view.data.name} />
            <ListRow title="Languages" meta={view.data.languages.content.join(", ")} />
          </Rows>
          {owner && draft === null ? <Button kind="primary" onClick={() => setDraft(view.data.name)}>Rename</Button> : null}
          {owner && draft !== null ? (
            <>
              <Field label="Name" value={draft} onChange={(event) => setDraft(event.target.value)} />
              <Button kind="primary" disabled={draft.trim() === ""} onClick={save}>Save</Button>
            </>
          ) : null}
          {owner ? <LanguagesEdit current={view.data.languages} onSaved={() => setSaved(saved + 1)} /> : null}
          {refused ? <LoadFailed words={refused} /> : null}
        </>
      ) : null}
    </Shell>
  );
}
