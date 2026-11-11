import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import "./drawerFrame.css";

type Drawer = {
  open: boolean;
  id: string | undefined;
  button: RefObject<HTMLButtonElement>;
  toggle: () => void;
  close: () => void;
};

const noButton: RefObject<HTMLButtonElement> = { current: null };

const idle: Drawer = { open: false, id: undefined, button: noButton, toggle: () => undefined, close: () => undefined };

const DrawerContext = createContext<Drawer>(idle);

export const useDrawer = () => useContext(DrawerContext);

type Props = { drawer: ReactNode; fluid?: boolean; children: ReactNode };

export function DrawerFrame({ drawer, fluid, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: Event) => {
      const target = event.target as Node;
      if (slot.current?.contains(target) || button.current?.contains(target)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const value = useMemo<Drawer>(() => ({ open, id, button, toggle: () => setOpen((was) => !was), close: () => setOpen(false) }), [open, id]);

  return (
    <DrawerContext.Provider value={value}>
      <div className={fluid ? "frame fluid" : "frame"}>
        <div ref={slot} id={id} className="drawer-slot">
          {open ? drawer : null}
        </div>
        <div className={open ? "page open" : "page"}>{children}</div>
      </div>
    </DrawerContext.Provider>
  );
}
