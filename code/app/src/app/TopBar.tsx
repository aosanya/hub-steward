import { useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../shared/language/language";
import { assumedGroupNow, subscribeAssumedGroup } from "../shared/wakala/assumedGroup";
import { openAgencyId, openAgencyName, subscribeAgencyName } from "../shared/wakala/openAgency";
import { useDrawer } from "../shared/ui/DrawerFrame";
import { groupsPaths } from "../features/groups/routePaths";

export type TopBarBack = { onClick: () => void; label?: string } | { to: string; label: string };

type Extras = { action?: ReactNode; menu?: boolean; unnamed?: boolean };

type Props = ({ title: string; back?: undefined } | { title?: string; back: TopBarBack }) & Extras;

function BackLink({ back }: { back: TopBarBack }) {
  if ("to" in back) {
    return (
      <Link className="back" to={back.to} aria-label={back.label}>
        ‹ {back.label}
      </Link>
    );
  }
  return (
    <button type="button" className="back" onClick={back.onClick} aria-label={back.label ? undefined : "Back"}>
      {back.label ? `‹ ${back.label}` : "‹"}
    </button>
  );
}

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </svg>
);

function MenuButton() {
  const { open, id, button, toggle } = useDrawer();
  return (
    <button ref={button} type="button" className="menu-btn" aria-label="Menu" aria-expanded={open} aria-controls={id} onClick={toggle}>
      <MenuIcon />
    </button>
  );
}

export function TopBar({ title, back, action, menu, unnamed }: Props) {
  const { words } = useLanguage();
  const agencyName = useSyncExternalStore(subscribeAgencyName, openAgencyName);
  const held = useSyncExternalStore(subscribeAssumedGroup, assumedGroupNow);
  const group = held && held.agencyId === openAgencyId() ? held : null;
  const switchable = Boolean(menu) && !back && group !== null && group.count >= 2;
  return (
    <header className="bar">
      {back ? <BackLink back={back} /> : <h1 className="title">{title}</h1>}
      {back && title ? <h1 className="bar-title">{title}</h1> : null}
      {action || menu ? (
        <div className="bar-action">
          {action}
          {switchable ? (
            <Link className="act" to={groupsPaths.switchGroup.path()}>
              {words.groupSwitch}
            </Link>
          ) : null}
          {menu ? <MenuButton /> : null}
        </div>
      ) : null}
      {agencyName && !unnamed ? <p className="bar-agency">{group?.name ? `${agencyName} · ${group.name}` : agencyName}</p> : null}
    </header>
  );
}
