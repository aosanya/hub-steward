import { ListRow, Rows } from "../../../../shared/ui/ListRow";
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

const ownRows = (item: Record<string, unknown>) => (
  <Rows>
    {((item.own as OwnAnswer[] | undefined) ?? []).map((own) => (
      <ListRow key={own.prompt} title={own.prompt} meta={own.answer} />
    ))}
  </Rows>
);

export const tenureDetail = {
  tool: tenureRead,
  fields: { Holder: "holder", Property: "property", Kind: "kind", Since: "began" },
  status: "",
  load: loadTenure,
  extra: ownRows,
};
