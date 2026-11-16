import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";
import { dayOf, digitaltwinModule, joined, loadRecords, textOf } from "./records";

export const tenureList = "digitaltwin_tenure_list";

const fields = { title: "holder", meta: "held" };

const loadTenures = () =>
  loadRecords(tenureList, (tenure) => ({
    holder: textOf(tenure.holder),
    held: joined([textOf(tenure.kind), dayOf(tenure.since) ? `since ${dayOf(tenure.since)}` : ""]),
  }));

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
    />
  );
}
