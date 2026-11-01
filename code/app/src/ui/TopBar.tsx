import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDrawer } from "./DrawerFrame";

export type TopBarBack = { onClick: () => void } | { to: string; label: string };

type Extras = { action?: ReactNode; menu?: boolean };

type Props = ({ title: string; back?: undefined } | { title?: undefined; back: TopBarBack }) & Extras;

function BackLink({ back }: { back: TopBarBack }) {
  if ("to" in back) {
    return (
      <Link className="back" to={back.to} aria-label={back.label}>
        ‹ {back.label}
      </Link>
    );
  }
  return (
    <button type="button" className="back" onClick={back.onClick} aria-label="Back">
      ‹
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

export function TopBar({ title, back, action, menu }: Props) {
  return (
    <header className="bar">
      {back ? <BackLink back={back} /> : <h1 className="title">{title}</h1>}
      {action || menu ? (
        <div className="bar-action">
          {action}
          {menu ? <MenuButton /> : null}
        </div>
      ) : null}
    </header>
  );
}
