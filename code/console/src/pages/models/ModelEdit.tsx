import { useConsole } from "../../shell/context";
import { useLoaded } from "../../shell/useLoaded";
import { ModelEditForm } from "./ModelEditForm";
import { ModelMissing } from "./ModelMissing";
import { loadEditable } from "./useEditModel";

export function ModelEdit({ accountId, onSaved }: { accountId: string; onSaved: () => void }) {
  const { hub } = useConsole();
  const { state: loaded, reload, received } = useLoaded(() => loadEditable(hub.id, accountId), [hub.id, accountId]);

  if (loaded.kind === "failed") return <ModelMissing />;
  if (loaded.kind === "loading") return null;

  const saved = () => {
    reload();
    onSaved();
  };
  return <ModelEditForm key={received} held={loaded.value} onSaved={saved} />;
}
