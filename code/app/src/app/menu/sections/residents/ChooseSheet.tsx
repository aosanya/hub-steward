import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Sheet } from "../../../../shared/ui/Sheet";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";

export type Choice = { id: string; title: string };

type Props = { title: string; loadKey: string; load: () => Promise<Choice[]>; onChoose: (id: string) => Promise<void>; onClose: () => void };

export function ChooseSheet({ title, loadKey, load, onChoose, onClose }: Props) {
  const view = useLoad(load, `${loadKey}:${openAgencyId()}`);
  const [refused, setRefused] = useState("");
  const choose = async (id: string) => {
    setRefused("");
    try {
      await onChoose(id);
    } catch (error) {
      setRefused(refusalWords(error));
    }
  };
  return (
    <Sheet title={title} onClose={onClose}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="The choices could not be loaded." /> : null}
      {view.state === "ready" ? (
        <Rows>
          {view.data.map((choice) => (
            <ListRow key={choice.id} title={choice.title} onClick={() => choose(choice.id)} end="›" />
          ))}
        </Rows>
      ) : null}
      {refused ? <LoadFailed words={refused} /> : null}
    </Sheet>
  );
}
