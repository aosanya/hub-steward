import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";

type Props = { nodeType: string; word: string; listPath: () => string };

const createTool = "actor_create_group";

const createPermission = "group.manage";

export function GroupNewScreen({ nodeType, word, listPath }: Props) {
  const navigate = useNavigate();
  const may = useMay(createPermission);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const leave = () => navigate(listPath());
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", createTool, { name: name.trim(), node_type: nodeType });
      leave();
    } catch (error) {
      setRefused(refusalWords(error));
      setSaving(false);
    }
  };
  return (
    <Shell title={`Add ${word}`} titleUnder backLabel={`All ${word}s`} onBack={leave} tabless>
      {may ? (
        <>
          <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
          {refused ? <LoadFailed words={refused} /> : null}
          <Button kind="primary" disabled={saving || name.trim() === ""} onClick={save}>Save</Button>
          <Button kind="quiet" disabled={saving} onClick={leave}>Cancel</Button>
        </>
      ) : (
        <LoadFailed words="You may not add this." />
      )}
    </Shell>
  );
}
