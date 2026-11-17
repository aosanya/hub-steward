import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { IssueListScreen } from "./IssueListScreen";
import { MeTooButton } from "./MeTooButton";

type Item = Record<string, unknown>;

export const wishesTool = "forms_catalog_board_item_list";

export const endorseTool = "forms_catalog_endorsement_add";

const count = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "number" ? value : 0;
};

const wishes = async () => itemsOf(await callTool("", wishesTool, {})) as Item[];

const countLines = (item: Item) => [`raised by ${count(item, "raised_by")}`, `${count(item, "me_too")} said Me too`];

const without = (ids: string[], id: string) => ids.filter((one) => one !== id);

export function WishesScreen() {
  const [said, setSaid] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [reloads, setReloads] = useState(0);
  const meToo = (id: string) => {
    setFailed((now) => without(now, id));
    callTool("", endorseTool, { subject_id: id }).then(
      () => {
        setSaid((now) => [...without(now, id), id]);
        setReloads((now) => now + 1);
      },
      () => setFailed((now) => [...without(now, id), id]),
    );
  };
  const end = (item: Item) => {
    const id = String(item.id ?? "");
    return <MeTooButton title={String(item.title ?? "")} said={said.includes(id)} failed={failed.includes(id)} onPress={() => meToo(id)} />;
  };
  return <IssueListScreen title="Wishes" tool={wishesTool} fields={{ title: "title", meta: "" }} empty="No wishes yet." load={wishes} lines={countLines} end={end} reloadKey={reloads} />;
}
