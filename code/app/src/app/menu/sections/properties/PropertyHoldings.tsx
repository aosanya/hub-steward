import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { useOpenFrom } from "../../useOpenFrom";
import { listOf } from "../staff/staffData";
import { placePaths } from "./paths";
import { dayOf, digitaltwinModule, joined, tenureList, textOf } from "./records";
import { placesTitle } from "./words";

const loadHoldings = (placeId: string) => async () => {
  if (placeId === "") return [];
  const tenures = await listOf(tenureList, { place_id: placeId });
  return tenures.map((tenure) => ({
    key: textOf(tenure.id),
    title: textOf(tenure.holder),
    meta: joined([textOf(tenure.kind), dayOf(tenure.since) ? `since ${dayOf(tenure.since)}` : ""]),
  }));
};

export function PropertyHoldings({ assetId, placeId }: { assetId: string; placeId: string }) {
  const word = useWord(digitaltwinModule);
  const open = useOpenFrom(word(placesTitle));
  const view = useLoad(loadHoldings(placeId), `property-holdings:${openAgencyId()}:${assetId}`);
  if (view.state === "error" || view.state === "loading") return null;
  return (
    <Section
      word={word("Holdings")}
      all
      icon="box"
      empty={{ words: "No holdings yet." }}
      rows={view.data.map((holding) => (
        <ListRow key={holding.key} title={holding.title} meta={holding.meta} onClick={() => open(`${placePaths.ownership.path()}/${holding.key}`)} end="›" />
      ))}
    />
  );
}
