import { useEffect, type ReactNode } from "react";
import "./sheet.css";

type Props = { title: string; onClose: () => void; children: ReactNode };

export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className="sheet-frame">
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="sheet-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
