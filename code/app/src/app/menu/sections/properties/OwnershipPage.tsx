import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";
import { dayOf, digitaltwinModule, joined, loadNodeNames, loadRecords, readRecord, tenureList, textOf } from "./records";

const fields = { title: "holder", meta: "held" };

const loadTenures = async () => {
  const names = await loadNodeNames();
  return loadRecords(tenureList, (tenure) => ({
    holder: textOf(tenure.holder),
    held: joined([
      names.get(textOf(tenure.place_id)) ?? "",
      textOf(tenure.kind),
      dayOf(tenure.since) ? `since ${dayOf(tenure.since)}` : "",
    ]),
  }));
};

const tenureRead = "digitaltwin_tenure_read";

const loadTenure = async (id: string) => {
  const [tenure, names] = await Promise.all([readRecord(tenureRead, "tenureID", id), loadNodeNames()]);
  return { ...tenure, property: names.get(textOf(tenure.place_id)) ?? "", began: dayOf(tenure.since) };
};

const detail = {
  tool: tenureRead,
  fields: { Holder: "holder", Property: "property", Kind: "kind", Since: "began" },
  status: "",
  load: loadTenure,
};

export function OwnershipPage() {
  const word = useWord("digitaltwin");
  return (
    <MountedMenuList
      module={digitaltwinModule}
      title={word("Ownership & Tenure")}
      tool={tenureList}
      fields={fields}
      empty={{ words: `No ${word("Properties").toLowerCase()} yet.` }}
      load={loadTenures}
      detail={detail}
    />
  );
}
