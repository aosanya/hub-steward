import { useState, type ReactNode } from "react";
import { useMay } from "../../../../features/agency/useMay";

type Props = { permission: string; act: string; sheet: (close: () => void) => ReactNode };

export function SectionAct({ permission, act, sheet }: Props) {
  const may = useMay(permission);
  const [open, setOpen] = useState(false);
  if (!may) return null;
  return (
    <>
      <button type="button" className="sec-act" onClick={() => setOpen(true)}>{act}</button>
      {open ? sheet(() => setOpen(false)) : null}
    </>
  );
}
