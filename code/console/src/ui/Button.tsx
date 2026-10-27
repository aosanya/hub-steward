import "./ui.css";
import { ButtonContent, buttonClass } from "./buttonLook";
import type { ButtonProps } from "./props";

export function Button({ kind = "primary", size, icon, wide, type = "button", className, children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ kind, size, wide }, className)} {...rest}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </button>
  );
}
