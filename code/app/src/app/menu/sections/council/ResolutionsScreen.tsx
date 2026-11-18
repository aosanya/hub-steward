import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { CouncilPage, DetailCard } from "./CouncilPage";
import { councilTools, homeEmpty, listOf, noneYet, text, type Item } from "./councilData";
import { loadResolution, outcomeWords } from "./councilRecords";

export const resolutionsTitle = "Resolutions";

const metaOf = (resolution: Item) => [text(resolution, "date"), outcomeWords(text(resolution, "outcome"))].filter((part) => part !== "").join(" · ");

const loadResolutions = async () => {
  const resolutions = await listOf(councilTools.resolutionList);
  return resolutions.map((resolution) => ({ id: text(resolution, "id"), title: text(resolution, "title"), meta: metaOf(resolution) }));
};

function ResolutionPage({ resolution }: { resolution: Item }) {
  return (
    <CouncilPage name={text(resolution, "title")} line={[text(resolution, "date"), text(resolution, "outcomeWords")].filter((part) => part !== "").join(" · ")}>
      <DetailCard word="Resolution detail" item={resolution} kind="resolutions" rows={[["Title", text(resolution, "title")], ["Date", text(resolution, "date")], ["Outcome", text(resolution, "outcomeWords")], ["Meeting", text(resolution, "meeting")]]} />
    </CouncilPage>
  );
}

export function ResolutionsScreen() {
  const word = useWord("council");
  const title = word(resolutionsTitle);
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={search.get("id") ?? undefined}
      list={{ title, tool: councilTools.resolutionList, load: loadResolutions, fields: { title: "title", meta: "meta" }, empty: homeEmpty(noneYet(word, resolutionsTitle, "No resolutions yet.")) }}
      detail={{ tool: councilTools.resolutionRead, load: loadResolution, fields: {}, status: "", extra: (resolution) => <ResolutionPage resolution={resolution} /> }}
    />
  );
}
