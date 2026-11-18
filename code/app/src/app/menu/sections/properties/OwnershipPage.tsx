import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";
import { dayOf, digitaltwinModule, joined, loadNodeNames, loadRecords, tenureList, textOf } from "./records";
import { tenureDetail } from "./tenureDetail";

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
      detail={tenureDetail}
    />
  );
}
