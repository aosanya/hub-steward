import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";
import { digitaltwinModule, joined, loadRecords, readRecord, textOf } from "./records";

export const landUseList = "digitaltwin_land_use_list";

const fields = { title: "zone", meta: "use" };

const loadLandUses = () =>
  loadRecords(landUseList, (landUse) => ({
    zone: textOf(landUse.zone),
    use: joined([textOf(landUse.use), textOf(landUse.area)]),
  }));

const landUseRead = "digitaltwin_land_use_read";

const detail = {
  tool: landUseRead,
  fields: { Zone: "zone", Use: "use", Area: "area" },
  status: "",
  load: (id: string) => readRecord(landUseRead, "landUseID", id),
};

export function LandUsePage() {
  const word = useWord("digitaltwin");
  return (
    <MountedMenuList
      module={digitaltwinModule}
      title={word("Land Use")}
      tool={landUseList}
      fields={fields}
      empty={{ words: `No ${word("Areas").toLowerCase()} yet.` }}
      load={loadLandUses}
      detail={detail}
    />
  );
}
