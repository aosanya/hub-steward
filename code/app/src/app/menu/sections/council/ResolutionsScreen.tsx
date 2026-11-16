import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { councilTools, homeEmpty, listOf, noneYet, readMeetingArgs, readResolutionArgs, text, type Item } from "./councilData";

export const resolutionsTitle = "Resolutions";

const outcomeWords = (outcome: string) => outcome.charAt(0).toUpperCase() + outcome.slice(1);

const metaOf = (resolution: Item) => [text(resolution, "date"), outcomeWords(text(resolution, "outcome"))].filter((part) => part !== "").join(" · ");

const loadResolutions = async () => {
  const resolutions = await listOf(councilTools.resolutionList);
  return resolutions.map((resolution) => ({ id: text(resolution, "id"), title: text(resolution, "title"), meta: metaOf(resolution) }));
};

const meetingName = async (meetingId: string) => {
  if (meetingId === "") return "";
  try {
    return text((await callTool("", councilTools.meetingRead, readMeetingArgs(meetingId))) as Item | null, "name");
  } catch {
    return "";
  }
};

const loadResolution = async (id: string) => {
  const resolution = (await callTool("", councilTools.resolutionRead, readResolutionArgs(id))) as Item | null;
  return {
    id,
    title: text(resolution, "title"),
    date: text(resolution, "date"),
    outcome: outcomeWords(text(resolution, "outcome")),
    meeting: await meetingName(text(resolution, "meeting_id")),
  };
};

export function ResolutionsScreen() {
  const word = useWord("council");
  const title = word(resolutionsTitle);
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: councilTools.resolutionList, load: loadResolutions, fields: { title: "title", meta: "meta" }, empty: homeEmpty(noneYet(word, resolutionsTitle, "No resolutions yet.")) }}
      detail={{ tool: councilTools.resolutionRead, load: loadResolution, fields: { Title: "title", Date: "date", Outcome: "outcome", Meeting: "meeting" }, status: "status" }}
    />
  );
}
