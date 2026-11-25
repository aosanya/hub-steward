import type { ReactNode } from "react";
import { ListRow } from "../../../shared/ui/ListRow";
import "../shared/backlogs.css";

type Props = { code: string; title: string; below?: ReactNode; onOpen?: () => void };

export function CodeRow({ code, title, below, onOpen }: Props) {
  return <ListRow className="code-row" start={<span className="issue-code">{code}</span>} title={title} below={below} end={onOpen ? "›" : undefined} onClick={onOpen} />;
}
