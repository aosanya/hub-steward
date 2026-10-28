import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

export type ButtonKind = "primary" | "quiet";

type Shared = { kind?: ButtonKind; className?: string };
type Pressed = Shared & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { to?: undefined };
type Going = Shared & { to: string; children: ReactNode };

export function Button({ kind = "quiet", className, to, ...rest }: Pressed | Going) {
  const classes = `btn ${kind}${className ? ` ${className}` : ""}`;
  if (to !== undefined) return <Link to={to} className={classes}>{rest.children}</Link>;
  return <button type="button" {...rest} className={classes} />;
}
