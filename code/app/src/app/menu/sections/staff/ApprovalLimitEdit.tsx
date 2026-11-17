import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { currencyUnit } from "../../../../features/forms/QuestionInput";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { personNameOf } from "../residents/personName";
import { listOf, text, type Item } from "./staffData";

export type StandingSeat = { id: string; actorId: string; limit: number | null };

const unknownHolderWords = "Holder";

const wholeNumberWords = "Approval limit must be a whole number";

const seatsOf = (role: Item): StandingSeat[] => (Array.isArray(role.seats) ? (role.seats as StandingSeat[]) : []);

const holderNames = async () => new Map((await listOf("actor_list_actors")).map((person) => [text(person, "id"), personNameOf(person)] as const));

const digitsOf = (typed: string) => typed.replace(/\s/g, "");

const currentDigits = (seat: StandingSeat) => (seat.limit === null ? "" : String(seat.limit));

function SeatLimit({ seat, holder, onSaved }: { seat: StandingSeat; holder: string; onSaved: () => void }) {
  const [typed, setTyped] = useState(currentDigits(seat));
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const digits = digitsOf(typed);
  const valid = digits === "" || /^\d+$/.test(digits);
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "actor_set_approval_limit", { assignment_id: seat.id, ...(digits ? { limit: Number(digits) } : {}) });
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div role="group" aria-label={holder}>
      <Field label={holder} unitAfter={currencyUnit} inputMode="numeric" value={typed} error={valid ? undefined : wholeNumberWords} onChange={(event) => setTyped(event.target.value)} />
      <Button kind="primary" disabled={saving || !valid || digits === currentDigits(seat)} onClick={save}>Save limit</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </div>
  );
}

function SeatLimits({ seats, onSaved }: { seats: StandingSeat[]; onSaved: () => void }) {
  const names = useLoad(holderNames, `holder-names:${openAgencyId()}`);
  const known = names.state === "ready" ? names.data : new Map<string, string>();
  return (
    <>
      <SectionHeading>Approval limits</SectionHeading>
      {seats.map((seat) => (
        <SeatLimit key={seat.id} seat={seat} holder={known.get(seat.actorId) || unknownHolderWords} onSaved={onSaved} />
      ))}
    </>
  );
}

export function ApprovalLimitEdit({ role, onSaved }: { role: Item; onSaved: () => void }) {
  const may = useMay("role.assign");
  const seats = seatsOf(role);
  return may && seats.length > 0 ? <SeatLimits seats={seats} onSaved={onSaved} /> : null;
}
