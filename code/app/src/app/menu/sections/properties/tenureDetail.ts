import { dayOf, loadNodeNames, readRecord, textOf } from "./records";

const tenureRead = "digitaltwin_tenure_read";

const loadTenure = async (id: string) => {
  const [tenure, names] = await Promise.all([readRecord(tenureRead, "tenureID", id), loadNodeNames()]);
  return { ...tenure, property: names.get(textOf(tenure.place_id)) ?? "", began: dayOf(tenure.since) };
};

export const tenureDetail = {
  tool: tenureRead,
  fields: { Holder: "holder", Property: "property", Kind: "kind", Since: "began" },
  status: "",
  load: loadTenure,
};
