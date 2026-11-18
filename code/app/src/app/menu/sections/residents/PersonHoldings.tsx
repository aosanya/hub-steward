import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { dayOf, digitaltwinModule, joined, loadNodeNames, tenureList, textOf } from "../properties/records";
import { listOf } from "../staff/staffData";
import { placePaths } from "../properties/paths";
import { useOpenFromPanel } from "./useOpenFromPanel";

const loadHoldings = (filter: Record<string, string>) => async () => {
  const [tenures, names] = await Promise.all([listOf(tenureList, filter), loadNodeNames()]);
  return tenures.map((tenure) => ({
    key: textOf(tenure.id),
    placeId: textOf(tenure.place_id),
    title: names.get(textOf(tenure.place_id)) || textOf(tenure.kind),
    meta: joined([textOf(tenure.kind), dayOf(tenure.since) ? `since ${dayOf(tenure.since)}` : ""]),
  }));
};

type Holding = { key: string; placeId: string; title: string; meta: string };

function HoldingRows({ holdings }: { holdings: Holding[] }) {
  const open = useOpenFromPanel();
  return (
    <Rows>
      {holdings.map((holding) => (
        <ListRow key={holding.key} title={holding.title} meta={holding.meta} {...(holding.placeId ? { onClick: () => open(placePaths.place.path({ placeId: holding.placeId })), end: "›" } : {})} />
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
