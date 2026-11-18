import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { loadRecordRow, loadRecordRows } from "../../liveRecordRows";
import { MenuWindow } from "../../MenuWindow";
import { RecordRowExtra } from "../../RecordRowExtra";
import { addressDetail, loadAddresses } from "../properties/AddressesPage";
import { placePaths } from "../properties/paths";
import { loadPlaces } from "../properties/records";
import { businessesRecordCode, useBusinessFields } from "./BusinessesScreen";
import { informalTradersRecordCode, useInformalTraderFields } from "./InformalTradersScreen";
import { homeEmpty, peopleRows } from "./PeopleScreens";
import { loadPerson, PersonPanel } from "./PersonScreen";

type Row = { id: string; title: string; meta: string };

const personKey = "person:";
const placeKey = "place:";
const addressKey = "address:";
const businessKey = "business:";
const traderKey = "trader:";
const kindKey = "searchKind";

const kinded = (kind: string, rows: Row[]) => rows.map((row) => ({ ...row, id: `${kind}${row.id}` }));

const kindsLoaded = async (loads: Promise<Row[]>[]) => {
  const settled = await Promise.allSettled(loads);
  const failed = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed.length === settled.length) throw failed[0].reason;
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
};

const loadEverything = () =>
  kindsLoaded([
    peopleRows().then((people) => kinded(personKey, people.map((person) => ({ id: person.id, title: person.name, meta: "" })))),
    loadAddresses().then((addresses) => kinded(addressKey, addresses.map((address) => ({ id: address.id, title: address.name, meta: address.place })))),
    loadPlaces().then((places) => kinded(placeKey, places.map((place) => ({ id: place.id, title: place.name, meta: place.category })))),
    loadRecordRows(businessesRecordCode, "Trading name", ["Kind of business", "Neighbourhood"]).then((rows) => kinded(businessKey, rows)),
    loadRecordRows(informalTradersRecordCode, "Name or alias", ["What is sold", "Neighbourhood"]).then((rows) => kinded(traderKey, rows)),
  ]);

const startsWithAny = (id: unknown, kinds: string[]) => kinds.some((kind) => String(id).startsWith(kind));

const promptsOf = (fields: { prompt: string; people?: boolean }[]) => fields.filter((field) => !field.people).map((field) => field.prompt);

const kindOfId = (id: string) => [personKey, addressKey, businessKey, traderKey].find((kind) => id.startsWith(kind)) ?? "";

export function SearchScreen() {
  const word = useWord("actor");
  const navigate = useNavigate();
  const here = useLocation();
  const [version, setVersion] = useState(0);
  const businessPrompts = promptsOf(useBusinessFields());
  const traderPrompts = promptsOf(useInformalTraderFields());
  const loadDetail = async (id: string): Promise<Record<string, unknown>> => {
    const kind = kindOfId(id);
    const bare = id.slice(kind.length);
    const loaded: Record<string, unknown> =
      kind === personKey ? await loadPerson(bare)
      : kind === addressKey ? await addressDetail.load(bare)
      : kind === businessKey ? await loadRecordRow(businessesRecordCode, bare, businessPrompts, "Owner")
      : kind === traderKey ? await loadRecordRow(informalTradersRecordCode, bare, traderPrompts, "Holder")
      : {};
    return { ...loaded, [kindKey]: kind };
  };
  const detailFields = Object.fromEntries([["Name", "display_name"], ...Object.entries(addressDetail.fields), ...[...businessPrompts, ...traderPrompts].map((prompt) => [prompt, prompt])]);
  const groups = (items: Record<string, unknown>[]) =>
    [
      { heading: word("People"), items: items.filter((item) => startsWithAny(item.id, [personKey])) },
      { heading: "Properties", items: items.filter((item) => startsWithAny(item.id, [addressKey, placeKey])) },
      { heading: "Businesses", items: items.filter((item) => startsWithAny(item.id, [businessKey])) },
      { heading: "Informal traders", items: items.filter((item) => startsWithAny(item.id, [traderKey])) },
    ].filter((group) => group.items.length > 0);
  const isPlace = (id: string) => id.startsWith(placeKey);
  const openPlace = (id: string) =>
    navigate(placePaths.place.path({ placeId: id.slice(placeKey.length) }), { state: { from: { path: `${here.pathname}${here.search}`, title: "Search" } } });
  return (
    <MenuWindow
      title="Search"
      listKey={version}
      detailKey={version}
      elsewhere={isPlace}
      leave={openPlace}
      list={{ title: "Search", tool: "search", fields: { title: "title", meta: "meta" }, empty: homeEmpty("Nothing to search yet."), load: loadEverything, groups }}
      detail={{
        tool: "actor_get_actor",
        load: loadDetail,
        fields: detailFields,
        status: "status",
        extra: (item) => {
          const kind = item[kindKey];
          if (kind === personKey) return <PersonPanel person={item} onSaved={() => setVersion((was) => was + 1)} />;
          if (kind === businessKey) return <RecordRowExtra row={item} recordCode={businessesRecordCode} owner={{ prompt: "Owner", heading: "Owner" }} />;
          if (kind === traderKey) return <RecordRowExtra row={item} recordCode={informalTradersRecordCode} owner={{ prompt: "Holder", heading: "Holder" }} />;
          return null;
        },
      }}
    />
  );
}
