import { Link } from "react-router-dom";
import { ButtonContent, buttonClass } from "./buttonLook";
import type { ButtonLinkProps } from "./props";

export function ButtonLink({ to, kind = "primary", size, icon, wide, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link to={to} className={buttonClass({ kind, size, wide }, className)} {...rest}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </Link>
  );
}
