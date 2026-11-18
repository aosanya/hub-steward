import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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

type GoProps = { permission: string; act: string; to: string };

export function SectionGo({ permission, act, to }: GoProps) {
  const may = useMay(permission);
  const navigate = useNavigate();
  if (!may) return null;
  return <button type="button" className="sec-act" onClick={() => navigate(to)}>{act}</button>;
}
