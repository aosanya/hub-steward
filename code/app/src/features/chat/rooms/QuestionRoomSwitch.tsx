import { useState } from "react";
import { Card } from "../../../shared/ui/Card";

type Props = { on: boolean; onChange: (on: boolean) => Promise<void> };

const label = "This room takes questions";

export function QuestionRoomSwitch({ on, onChange }: Props) {
  const [failed, setFailed] = useState(false);
  const flip = async (next: boolean) => {
    setFailed(false);
    try {
      await onChange(next);
    } catch {
      setFailed(true);
    }
  };
  return (
    <Card title="Questions">
      <label className="rm-switch">
        <input type="checkbox" checked={on} onChange={(event) => flip(event.target.checked)} />
        <span>{label}</span>
      </label>
      <p className="rm-note">{on ? "Members ask in their own conversation, which only they and the room's leaders read." : "Members write in the open thread."}</p>
      {failed ? <p className="rm-note" role="alert">The switch could not be changed.</p> : null}
    </Card>
  );
}
