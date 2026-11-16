import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { actionFailedWords, loadFailedWords } from "../../MenuDetail";
import { useBackToSection } from "../../useBackToSection";

type Profile = { name: string; languages: string };

const loadProfile = async (): Promise<Profile> => {
  const [agency, languages] = await Promise.all([callTool("", "agency_get_agency"), callTool("", "instance_get_languages")]);
  const content = (languages as { content?: unknown } | null)?.content;
  return {
    name: String((agency as { name?: unknown } | null)?.name ?? ""),
    languages: Array.isArray(content) ? content.join(", ") : "",
  };
};

export function AgencyProfile() {
  const back = useBackToSection();
  const [saved, setSaved] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const view = useLoad(loadProfile, `agency-profile:${openAgencyId()}:${saved}`);
  const save = async () => {
    try {
      await callTool("", "instance_rename", { name: draft });
      setFailed(false);
      setDraft(null);
      setSaved(saved + 1);
    } catch {
      setFailed(true);
    }
  };
  return (
    <Shell title="Agency Profile" titleUnder {...back}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} /> : null}
      {view.state === "ready" ? (
        <>
          <Rows>
            <ListRow title="Name" meta={view.data.name} />
            <ListRow title="Languages" meta={view.data.languages} />
          </Rows>
          {draft === null ? (
            <Button kind="primary" onClick={() => setDraft(view.data.name)}>Rename</Button>
          ) : (
            <>
              <Field label="Name" value={draft} onChange={(event) => setDraft(event.target.value)} />
              <Button kind="primary" disabled={draft.trim() === ""} onClick={save}>Save</Button>
            </>
          )}
          {failed ? <LoadFailed words={actionFailedWords} /> : null}
        </>
      ) : null}
    </Shell>
  );
}
