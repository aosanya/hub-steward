import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { refusalWords } from "../../MenuEditForm";

export type Seat = { id: string; role: string };

type Props = { seats: Seat[]; onEnded: () => void };

export function SeatEnd({ seats, onEnded }: Props) {
  const may = useMay("role.assign");
  const [busy, setBusy] = useState("");
  const [refused, setRefused] = useState("");
  if (!may) return null;
  const end = async (seat: Seat) => {
    setBusy(seat.id);
    setRefused("");
    try {
      await callTool("", "actor_revoke_role", { assignment_id: seat.id });
      onEnded();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      {seats.map((seat) => (
        <Button key={seat.id} kind="quiet" disabled={busy !== ""} onClick={() => end(seat)}>{`End role: ${seat.role}`}</Button>
      ))}
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
