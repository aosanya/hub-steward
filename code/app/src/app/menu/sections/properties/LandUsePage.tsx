import { useWord } from "../../../../features/agency/useWord";
import { PageFrame } from "../../PageFrame";
import { ChatAboutProperty } from "./ChatAboutProperty";
import { FactsCard } from "../../FactsCard";
import { placePaths } from "./paths";
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

function LandUseCards({ landUse }: { landUse: Record<string, unknown> }) {
  const word = useWord("digitaltwin");
  const zone = textOf(landUse.zone);
  return (
    <>
      <ChatAboutProperty kind="land-use" id={textOf(landUse.id)} name={zone} back={placePaths.landUse.path()} />
      <PageFrame title={zone} line={textOf(landUse.use)}>
        <FactsCard word={`${word("Land Use")} detail`} facts={[["Zone", zone], ["Use", textOf(landUse.use)], ["Area", textOf(landUse.area)]]} />
      </PageFrame>
    </>
  );
}

const detail = {
  tool: landUseRead,
  fields: {},
  status: "",
  load: (id: string) => readRecord(landUseRead, "landUseID", id),
  extra: (landUse: Record<string, unknown>) => <LandUseCards landUse={landUse} />,
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
