import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
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
  if (view.state === "error") return null;
  const holdings = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Holdings")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && holdings.length === 0 ? <EmptyCard words="No holdings yet." /> : null}
      {holdings.length > 0 ? (
        <Rows>
          {holdings.map((holding) => (
            <ListRow key={holding.key} title={holding.title} meta={holding.meta} onClick={() => open(`${placePaths.ownership.path()}/${holding.key}`)} end="›" />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
