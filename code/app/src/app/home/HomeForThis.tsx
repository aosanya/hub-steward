import { useLanguage } from "../../shared/language/language";
import { HomeNodeRows, type HomeRowContext } from "./HomeNodeRows";
import type { HomeNode } from "./homeDeclaration";
import type { HomeFacts } from "./homeFacts";

type Props = { thing: string; nodes: HomeNode[]; facts: HomeFacts; row: HomeRowContext; from: { path: string; title: string } };

export function HomeForThis({ thing, nodes, facts, row, from }: Props) {
  const { words } = useLanguage();
  if (nodes.length === 0) return null;
  return (
    <>
      <h2 className="home-for-this">{words.homeForThis.replace("{thing}", thing)}</h2>
      <HomeNodeRows nodes={nodes} facts={facts} row={row} from={from} />
    </>
  );
}
