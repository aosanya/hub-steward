import { Link } from "react-router-dom";
import type { TabsProps } from "./props";

export function Tabs({ items }: TabsProps) {
  return (
    <nav className="tabs">
      {items.map((item) => (
        <Link key={item.to} className="tab" to={item.to} aria-current={item.current ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
