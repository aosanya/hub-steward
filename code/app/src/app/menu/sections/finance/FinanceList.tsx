import type { ComponentProps } from "react";
import { Shell } from "../../../Shell";
import { MenuList } from "../../MenuList";
import { useBackToSection } from "../../useBackToSection";

export function FinanceList(props: Omit<ComponentProps<typeof MenuList>, "bare">) {
  const back = useBackToSection();
  return (
    <Shell title={props.title} titleUnder {...back}>
      <MenuList {...props} bare />
    </Shell>
  );
}
