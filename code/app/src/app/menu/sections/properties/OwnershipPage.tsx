import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { AddButton } from "../../AddButton";
import { MountedMenuList } from "./MountedMenuList";
import { placePaths } from "./paths";
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
  const [search] = useSearchParams();
  return (
    <MountedMenuList
      above={<AddButton permission="digitaltwin.manage" label="Add holding" to={placePaths.holdingNew.path()} />}
      startAt={search.get("holding") ?? undefined}
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
