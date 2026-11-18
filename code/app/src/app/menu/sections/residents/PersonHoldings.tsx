import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { dayOf, digitaltwinModule, joined, loadNodeNames, placeIdOf, tenureList, textOf } from "../properties/records";
import { listOf } from "../staff/staffData";
import { placePaths } from "../properties/paths";
import { useOpenFromPanel } from "./useOpenFromPanel";

const loadAssetIdsByPlace = async () => {
  try {
    const assets: Record<string, unknown>[] = itemsOf(await callTool("", "assetmanager_asset_list"));
    return new Map(assets.map((asset) => [placeIdOf(asset.attributes_json), textOf(asset.id)] as const).filter(([placeId]) => placeId !== ""));
  } catch {
    return new Map<string, string>();
  }
};

const pathOf = (assetId: string | undefined, tenureId: string) => (assetId ? placePaths.place.path({ placeId: assetId }) : placePaths.holding.path({ tenureId }));

const loadHoldings = (filter: Record<string, string>) => async () => {
  const [tenures, names, assetIds] = await Promise.all([listOf(tenureList, filter), loadNodeNames(), loadAssetIdsByPlace()]);
  return tenures.map((tenure) => ({
    key: textOf(tenure.id),
    opens: pathOf(assetIds.get(textOf(tenure.place_id)), textOf(tenure.id)),
    title: names.get(textOf(tenure.place_id)) || textOf(tenure.kind),
    meta: joined([textOf(tenure.kind), dayOf(tenure.since) ? `since ${dayOf(tenure.since)}` : ""]),
  }));
};

type Holding = { key: string; opens: string; title: string; meta: string };

function HoldingRows({ holdings }: { holdings: Holding[] }) {
  const open = useOpenFromPanel();
  return (
    <Rows>
      {holdings.map((holding) => (
        <ListRow key={holding.key} title={holding.title} meta={holding.meta} onClick={() => open(holding.opens)} end="›" />
      ))}
    </Rows>
  );
}

export function PersonHoldings({ id }: { id: string }) {
  const word = useWord(digitaltwinModule);
  const view = useLoad(loadHoldings({ holder_actor_id: id }), `person-holdings:${openAgencyId()}:${id}`);
  if (view.state === "error") return null;
  const holdings = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Holdings")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && holdings.length === 0 ? <EmptyCard words="No holdings yet." /> : null}
      {holdings.length > 0 ? <HoldingRows holdings={holdings} /> : null}
    </>
  );
}

export function RowHoldings({ rowId }: { rowId: string }) {
  const word = useWord(digitaltwinModule);
  const view = useLoad(loadHoldings({ holder_record_row_id: rowId }), `record-holdings:${openAgencyId()}:${rowId}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return (
    <>
      <SectionHeading>{word("Holdings")}</SectionHeading>
      <HoldingRows holdings={view.data} />
    </>
  );
}
