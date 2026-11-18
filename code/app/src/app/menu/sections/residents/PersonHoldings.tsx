import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { dayOf, digitaltwinModule, loadNodeNames, placeIdOf, tenureList, textOf } from "../properties/records";
import { listOf } from "../staff/staffData";
import { loadHoldingDetails, loadOwnAnswers, withOwnAnswers } from "../properties/holdingDetails";
import { placePaths } from "../properties/paths";
import { useOpenSection } from "./personSections";
import { SectionGo } from "./SectionAct";
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
  const [tenures, names, assetIds, details] = await Promise.all([listOf(tenureList, filter), loadNodeNames(), loadAssetIdsByPlace(), loadHoldingDetails()]);
  return Promise.all(
    tenures.map(async (tenure) => {
      const own = await loadOwnAnswers(details, textOf(tenure.id));
      return {
        key: textOf(tenure.id),
        opens: pathOf(assetIds.get(textOf(tenure.place_id)), textOf(tenure.id)),
        title: (details.isOn("Property") ? names.get(textOf(tenure.place_id)) : "") || textOf(tenure.kind),
        meta: withOwnAnswers(
          [details.isOn("Kind") ? textOf(tenure.kind) : "", details.isOn("Since") && dayOf(tenure.since) ? `since ${dayOf(tenure.since)}` : ""],
          own,
        ),
      };
    }),
  );
};

type Holding = { key: string; opens: string; title: string; meta: string };

const holdingRows = (holdings: Holding[], open: (path: string) => void) =>
  holdings.map((holding) => <ListRow key={holding.key} title={holding.title} meta={holding.meta} onClick={() => open(holding.opens)} end="›" />);

export function PersonHoldings({ id, full }: { id: string; full?: boolean }) {
  const word = useWord(digitaltwinModule);
  const open = useOpenFromPanel();
  const opens = useOpenSection(id, "holdings");
  const view = useLoad(loadHoldings({ holder_actor_id: id }), `person-holdings:${openAgencyId()}:${id}`);
  if (view.state === "error") return null;
  const holdings = view.state === "ready" ? view.data : [];
  return (
    <>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" ? <Section icon="box" word={word("Holdings")} full={full} opens={opens} foot={<SectionGo permission="digitaltwin.manage" act="Add holding" to={placePaths.holdingNew.path()} />} empty={{ words: "No holdings yet." }} rows={holdingRows(holdings, open)} /> : null}
    </>
  );
}

export function RowHoldings({ rowId }: { rowId: string }) {
  const word = useWord(digitaltwinModule);
  const open = useOpenFromPanel();
  const view = useLoad(loadHoldings({ holder_record_row_id: rowId }), `record-holdings:${openAgencyId()}:${rowId}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return <Section icon="box" word={word("Holdings")} foot={<SectionGo permission="digitaltwin.manage" act="Add holding" to={placePaths.holdingNew.path()} />} rows={holdingRows(view.data, open)} />;
}
