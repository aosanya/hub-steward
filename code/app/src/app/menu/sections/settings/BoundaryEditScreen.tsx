import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMayAnswer } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { groupEditArgs, groupEditTool } from "../../groupEdit";
import { refusalWords } from "../../MenuEditForm";
import { boundaryArgs, cornersFromText, outerRingOf, textFromCorners } from "./boundary";
import { settingsPaths } from "./paths";

type Group = Record<string, unknown>;

const notAllowedWords = "You may not change this.";

const unreadableWords = "Give at least three corners, one longitude and latitude to a line.";

const loadGroup = async (id: string) => (await callTool("", "actor_get_group", { group_id: id })) as Group | null;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

function BoundaryEditForm({ id, group, done }: { id: string; group: Group | null; done: () => void }) {
  const shownName = textOf(group?.name);
  const shownNode = textOf(group?.area_node_id);
  const shownCorners = textFromCorners(outerRingOf(group));
  const [name, setName] = useState(shownName);
  const [node, setNode] = useState(shownNode);
  const [corners, setCorners] = useState(shownCorners);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const parsed = cornersFromText(corners);
  const readable = corners.trim() === "" || parsed !== null;
  const changed = name !== shownName || node !== shownNode || corners !== shownCorners;
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      if (name !== shownName) await callTool("", groupEditTool, groupEditArgs(id, group ?? {}, name));
      if (node !== shownNode) await callTool("", "actor_set_group_area_node", { group_id: id, area_node_id: node });
      if (corners !== shownCorners) await callTool("", "actor_set_group_boundary", boundaryArgs(id, parsed));
      done();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <Field label="Area node" value={node} onChange={(event) => setNode(event.target.value)} />
      <TextArea label="Boundary corners" rows={6} value={corners} onChange={(event) => setCorners(event.target.value)} />
      {readable ? null : <LoadFailed words={unreadableWords} />}
      <Button kind="primary" disabled={saving || !readable || !changed || name.trim() === ""} onClick={save}>Save</Button>
      <Button kind="quiet" disabled={saving} onClick={done}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function BoundaryEditScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { known, may } = useMayAnswer("group.manage");
  const view = useLoad(() => loadGroup(id), `boundary-edit:${openAgencyId()}:${id}`);
  const back = () => navigate(settingsPaths.boundariesAndAreas.path({ item: id }));
  const name = view.state === "ready" ? textOf(view.data?.name) : "";
  return (
    <Shell title="Edit boundary" titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" && known && may ? <div className="person-page"><BoundaryEditForm id={id} group={view.data} done={back} /></div> : null}
      {view.state === "ready" && known && !may ? (
        <div className="person-page">
          <p className="quiet-line">{notAllowedWords}</p>
          <Button kind="quiet" onClick={back}>Back</Button>
        </div>
      ) : null}
    </Shell>
  );
}
