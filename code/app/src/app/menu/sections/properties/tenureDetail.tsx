import { useWord } from "../../../../features/agency/useWord";
import { PageFrame } from "../../PageFrame";
import { ChatAboutProperty } from "./ChatAboutProperty";
import { PropertyFacts } from "./PropertyFacts";
import { placePaths } from "./paths";
import { loadHoldingDetails, loadOwnAnswers, type OwnAnswer } from "./holdingDetails";
import { dayOf, loadNodeNames, readRecord, textOf } from "./records";

const tenureRead = "digitaltwin_tenure_read";

const loadTenure = async (id: string) => {
  const [tenure, names, details] = await Promise.all([readRecord(tenureRead, "tenureID", id), loadNodeNames(), loadHoldingDetails()]);
  const own = await loadOwnAnswers(details, id);
  return {
    ...tenure,
    property: details.isOn("Property") ? names.get(textOf(tenure.place_id)) ?? "" : "",
    kind: details.isOn("Kind") ? textOf(tenure.kind) : "",
    began: details.isOn("Since") ? dayOf(tenure.since) : "",
    own,
  };
};

function HoldingCards({ holding }: { holding: Record<string, unknown> }) {
  const word = useWord("digitaltwin");
  const holder = textOf(holding.holder);
  const own = (holding.own as OwnAnswer[] | undefined) ?? [];
  const facts: [string, string][] = [["Holder", holder], ["Property", textOf(holding.property)], ["Kind", textOf(holding.kind)], ["Since", textOf(holding.began)], ...own.map((answer): [string, string] => [answer.prompt, answer.answer])];
  const id = textOf(holding.id);
  return (
    <>
      <ChatAboutProperty kind="holding" id={id} name={holder} back={`${placePaths.ownership.path()}?holding=${id}`} />
      <PageFrame title={holder} line={textOf(holding.kind)}>
        <PropertyFacts word={`${word("Holding")} detail`} facts={facts} />
      </PageFrame>
    </>
  );
}

export const tenureDetail = {
  tool: tenureRead,
  fields: {},
  status: "",
  load: loadTenure,
  extra: (holding: Record<string, unknown>) => <HoldingCards holding={holding} />,
};
