import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { homeEmpty } from "../staff/staffData";
import { ChatAboutRounds } from "./ChatAboutRounds";
import { loadNeighbourhoodRows, roundsTools } from "./roundsData";

export function RoundsByNeighbourhoodScreen() {
  const word = useWord("forms");
  const title = word("Rounds by Neighbourhood");
  const loadOne = async (id: string) => (await loadNeighbourhoodRows()).find((row) => row.id === id) ?? { id };
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      list={{ title, tool: roundsTools.forms, load: loadNeighbourhoodRows, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No neighbourhoods yet.") }}
      detail={{ tool: roundsTools.forms, load: loadOne, fields: { Neighbourhood: "name", "Rounds asked": "asked", Answered: "answered", Population: "population", Share: "share" }, status: "status", extra: (row) => <ChatAboutRounds row={row} /> }}
    />
  );
}
