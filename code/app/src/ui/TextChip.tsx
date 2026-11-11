import type { ReactNode } from "react";
import { Chip } from "./Chip";
import { textLook } from "./textColor";

type Props = { text: string; children?: ReactNode; onClick?: () => void; pressed?: boolean };

export function TextChip({ text, children, onClick, pressed }: Props) {
  return (
    <Chip {...textLook(text)} onClick={onClick} pressed={pressed}>
      {children ?? text}
    </Chip>
  );
}
