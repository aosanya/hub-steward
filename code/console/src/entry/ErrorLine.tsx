import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="ent-error" role="alert">
      <Icon name="alert" size={16} />
      {children}
    </p>
  );
}
