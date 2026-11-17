import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { MountedMenuList } from "./MountedMenuList";
import { dayOf, digitaltwinModule, joined, loadRecords, textOf } from "./records";

export const tenureList = "digitaltwin_tenure_list";
const nodeList = "digitaltwin_node_list";

const fields = { title: "holder", meta: "held" };

const loadNodeNames = async () => {
  try {
    const nodes: Record<string, unknown>[] = itemsOf(await callTool("", nodeList));
    return new Map(nodes.map((node) => [textOf(node.id), textOf(node.name)]));
  } catch {
    return new Map<string, string>();
  }
};

const loadTenures = async () => {
  const names = await loadNodeNames();
  return loadRecords(tenureList, (tenure) => ({
    holder: textOf(tenure.holder),
    held: joined([
      names.get(textOf(tenure.place_id)) ?? "",
      textOf(tenure.kind),
      dayOf(tenure.since) ? `since ${dayOf(tenure.since)}` : "",
    ]),
  }));
};

export function OwnershipPage() {
  const word = useWord("digitaltwin");
  return (
    <MountedMenuList
      module={digitaltwinModule}
      title={word("Ownership & Tenure")}
      tool={tenureList}
      fields={fields}
      empty={{ words: `No ${word("Properties").toLowerCase()} yet.` }}
      load={loadTenures}
    />
  );
}
