import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { councilTools, homeEmpty, listOf, noneYet, readBylawArgs, text, type Bylaw, type Item } from "./councilData";

export const bylawsTitle = "Rules";

const loadBylaws = async () =>
  (await listOf(councilTools.bylawList)).map((bylaw) => ({ id: text(bylaw, "id"), title: text(bylaw, "title"), year: text(bylaw, "year") }));

const loadBylaw = async (id: string): Promise<Item> => {
  const reply = (await callTool("", councilTools.bylawRead, readBylawArgs(id))) as { item?: Partial<Bylaw> } | Partial<Bylaw> | null;
  const bylaw = (reply && "item" in reply ? reply.item : reply) ?? {};
  return { id, title: text(bylaw, "title"), year: text(bylaw, "year"), text: text(bylaw, "text") };
};

export function BylawsScreen() {
  const word = useWord("council");
  const title = word(bylawsTitle);
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: councilTools.bylawList, load: loadBylaws, fields: { title: "title", meta: "year" }, empty: homeEmpty(noneYet(word, bylawsTitle, "No bylaws yet.")) }}
      detail={{ tool: councilTools.bylawRead, load: loadBylaw, fields: { Title: "title", Year: "year", Text: "text" }, status: "status" }}
    />
  );
}
