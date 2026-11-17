import type { ReactNode } from "react";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuList } from "../../MenuList";
import { useBackToSection } from "../../useBackToSection";

type Item = Record<string, unknown>;

type Props = {
  title: string;
  tool: string;
  fields: { title: string; meta: string };
  empty: string;
  load?: () => Promise<Item[]>;
  onChoose?: (id: string) => void;
  lines?: (item: Item) => string[];
  end?: (item: Item) => ReactNode;
  reloadKey?: number;
};

export function IssueListScreen({ title, tool, fields, empty, load, onChoose, lines, end, reloadKey }: Props) {
  const back = useBackToSection();
  return (
    <Shell title={title} titleUnder {...back}>
      <MenuList bare title={title} tool={tool} fields={fields} empty={{ words: empty, act: "Home", to: agencyHomePath(openAgencyId()) }} load={load} onChoose={onChoose} lines={lines} end={end} reloadKey={reloadKey} />
    </Shell>
  );
}
