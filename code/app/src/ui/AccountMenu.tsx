import { useEffect, useRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useDrawer } from "./DrawerFrame";
import { ListRow } from "./ListRow";
import "./accountMenu.css";

export const accountItems: { title: string; path: string }[] = [
  { title: "My profile", path: "/profile" },
  { title: "Switch agency", path: "/agencies" },
  { title: "Change language", path: "/language" },
  { title: "Sign out", path: "/sign-out" },
];

const itemSelector = '[role="menuitem"]';

export function AccountMenu() {
  const navigate = useNavigate();
  const { close } = useDrawer();
  const menu = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>(itemSelector) ?? []);

  useEffect(() => {
    items()[0]?.focus();
  }, []);

  const choose = (path: string) => {
    close();
    navigate(path);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const list = items();
    const at = list.findIndex((item) => item === document.activeElement);
    list[(at + step + list.length) % list.length]?.focus();
  };

  return (
    <div className="drawer">
      <div ref={menu} className="rows" role="menu" aria-label="Menu" onKeyDown={onKeyDown}>
        {accountItems.map((item) => (
          <ListRow
            key={item.path}
            role="menuitem"
            lead
            title={item.title}
            end="›"
            onClick={() => choose(item.path)}
          />
        ))}
      </div>
    </div>
  );
}
