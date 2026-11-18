import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { AddButton } from "../../AddButton";
import { MenuWindow } from "../../MenuWindow";
import { councilPaths } from "./paths";
import { ChatAboutBylaw } from "./ChatAboutCouncil";
import { CouncilPage, DetailCard } from "./CouncilPage";
import { councilTools, homeEmpty, listOf, noneYet, text, type Item } from "./councilData";
import { loadBylaw } from "./councilRecords";

export const bylawsTitle = "Rules";

const loadBylaws = async () =>
  (await listOf(councilTools.bylawList)).map((bylaw) => ({ id: text(bylaw, "id"), title: text(bylaw, "title"), year: text(bylaw, "year") }));

function BylawPage({ bylaw }: { bylaw: Item }) {
  return (
    <CouncilPage name={text(bylaw, "title")} line={text(bylaw, "year")}>
      <ChatAboutBylaw bylaw={bylaw} />
      <DetailCard word="Bylaw detail" item={bylaw} kind="bylaws" rows={[["Title", text(bylaw, "title")], ["Year", text(bylaw, "year")], ["Text", text(bylaw, "text")]]} />
    </CouncilPage>
  );
}

export function BylawsScreen() {
  const word = useWord("council");
  const title = word(bylawsTitle);
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      above={<AddButton permission="council.manage" label={`Add ${word("Bylaw").toLowerCase()}`} to={councilPaths.bylawNew.path()} />}
      startAt={search.get("id") ?? undefined}
      list={{ title, tool: councilTools.bylawList, load: loadBylaws, fields: { title: "title", meta: "year" }, empty: homeEmpty(noneYet(word, bylawsTitle, "No bylaws yet.")) }}
      detail={{ tool: councilTools.bylawRead, load: loadBylaw, fields: {}, status: "", extra: (bylaw) => <BylawPage bylaw={bylaw} /> }}
    />
  );
}
