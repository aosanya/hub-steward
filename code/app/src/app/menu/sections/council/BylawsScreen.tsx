import { useState } from "react";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { councilTools, homeEmpty, listOf, manageCouncil, noneYet, readBylawArgs, text, type Bylaw, type Item } from "./councilData";

export const bylawsTitle = "Rules";

const loadBylaws = async () =>
  (await listOf(councilTools.bylawList)).map((bylaw) => ({ id: text(bylaw, "id"), title: text(bylaw, "title"), year: text(bylaw, "year") }));

const loadBylaw = async (id: string): Promise<Item> => {
  const reply = (await callTool("", councilTools.bylawRead, readBylawArgs(id))) as { item?: Partial<Bylaw> } | Partial<Bylaw> | null;
  const bylaw = (reply && "item" in reply ? reply.item : reply) ?? {};
  return { id, title: text(bylaw, "title"), year: text(bylaw, "year"), text: text(bylaw, "text") };
};

const editFields: EditField[] = [
  { label: "Title", key: "title", required: true },
  { label: "Year", key: "year", kind: "number", required: true },
  { label: "Text", key: "text", required: true },
];

export function BylawsScreen() {
  const word = useWord("council");
  const title = word(bylawsTitle);
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={title}
      listKey={version}
      detailKey={version}
      list={{ title, tool: councilTools.bylawList, load: loadBylaws, fields: { title: "title", meta: "year" }, empty: homeEmpty(noneYet(word, bylawsTitle, "No bylaws yet.")) }}
      detail={{ tool: councilTools.bylawRead, load: loadBylaw, fields: { Title: "title", Year: "year", Text: "text" },
        status: "status",
        extra: (bylaw) => (
          <MenuEditForm
            item={bylaw}
            id={text(bylaw, "id")}
            idArg="bylawID"
            tool={councilTools.bylawUpdate}
            permission={manageCouncil}
            fields={editFields}
            keep={["title", "year", "text"]}
            readAgain={() => loadBylaw(text(bylaw, "id"))}
            onSaved={() => setVersion((was) => was + 1)}
          />
        ),
      }}
    />
  );
}
