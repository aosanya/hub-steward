import { useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { openAgencyName, subscribeAgencyName } from "../agency/open";
import { useDrawer } from "./DrawerFrame";

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
  const agencyName = useSyncExternalStore(subscribeAgencyName, openAgencyName);
  return (
    <header className="bar">
      {back ? <BackLink back={back} /> : <h1 className="title">{title}</h1>}
      {back && title ? <h1 className="bar-title">{title}</h1> : null}
      {action || menu ? (
        <div className="bar-action">
          {action}
          {menu ? <MenuButton /> : null}
        </div>
      ) : null}
      {agencyName && !unnamed ? <p className="bar-agency">{agencyName}</p> : null}
    </header>
  );
}
