import { useRef, useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuWindow } from "../../MenuWindow";
import { areaLinesOf, loadAreaTally } from "./AreaCounts";
import { MeTooButton } from "./MeTooButton";

type Item = Record<string, unknown>;

export const wishesTool = "forms_catalog_board_item_list";

export const endorseTool = "forms_catalog_endorsement_add";

const count = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "number" ? value : 0;
};

const kindWords: Record<string, string> = { complaint: "Complaint", idea: "Idea" };

const kindOf = (item: Item) => kindWords[String(item.kind ?? "")] ?? "";

const countsOf = (item: Item) => `${kindOf(item) ? `${kindOf(item)} · ` : ""}raised by ${count(item, "raised_by")} · ${count(item, "me_too")} said Me too`;

const wishRows = async () => {
  const [wishes, areas] = await Promise.all([callTool("", wishesTool, {}), loadAreaTally()]);
  return (itemsOf(wishes) as Item[]).map((item) => ({ ...item, kindWord: kindOf(item), counts: countsOf(item), areas: areas.get(String(item.id ?? "")) ?? [] }));
};

const linesOf = (item: Item) => [String(item.counts ?? ""), ...areaLinesOf(item)];

const without = (ids: string[], id: string) => ids.filter((one) => one !== id);

const wishFields = { Title: "title", Kind: "kindWord", "Raised by": "raised_by", "Said Me too": "me_too" };

export function WishesScreen() {
  const [said, setSaid] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [reloads, setReloads] = useState(0);
  const latest = useRef<Promise<Item[]> | null>(null);
  const fetchWishes = () => {
    const pending = wishRows();
    latest.current = pending;
    pending.catch(() => {
      if (latest.current === pending) latest.current = null;
    });
    return pending;
  };
  const current = () => latest.current ?? fetchWishes();
  const loadWish = async (id: string) => (await current()).find((item) => item.id === id) ?? { id };
  const meToo = (id: string) => {
    setFailed((now) => without(now, id));
    callTool("", endorseTool, { subject_id: id }).then(
      () => {
        setSaid((now) => [...without(now, id), id]);
        fetchWishes();
        setReloads((now) => now + 1);
      },
      () => setFailed((now) => [...without(now, id), id]),
    );
  };
  const button = (item: Item) => {
    const id = String(item.id ?? "");
    return <MeTooButton title={String(item.title ?? "")} said={said.includes(id)} failed={failed.includes(id)} onPress={() => meToo(id)} />;
  };
  const title = "Wishes";
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: wishesTool, fields: { title: "title", meta: "counts" }, lines: linesOf, empty: { words: "No wishes yet.", act: "Home", to: agencyHomePath(openAgencyId()) }, load: current }}
      detail={{ tool: wishesTool, fields: wishFields, status: "", load: loadWish, extra: button }}
      listKey={reloads}
      detailKey={reloads}
    />
  );
}
