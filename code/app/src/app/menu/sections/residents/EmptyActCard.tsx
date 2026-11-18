import { useState, type ReactNode } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { EmptyCard } from "../../../../shared/ui/LoadState";

type Props = { words: string; permission: string; act: string; sheet: (close: () => void) => ReactNode };

export function EmptyActCard({ words, permission, act, sheet }: Props) {
  const may = useMay(permission);
  const [open, setOpen] = useState(false);
  return (
    <>
      <EmptyCard words={words}>{may ? <Button onClick={() => setOpen(true)}>{act}</Button> : null}</EmptyCard>
      {open ? sheet(() => setOpen(false)) : null}
    </>
  );
}
