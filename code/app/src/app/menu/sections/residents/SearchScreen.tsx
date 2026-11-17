import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { loadRecordRows } from "../../liveRecordRows";
import { MenuWindow } from "../../MenuWindow";
import { loadAddresses } from "../properties/AddressesPage";
import { placePaths } from "../properties/paths";
import { loadPlaces } from "../properties/records";
import { businessesRecordCode } from "./BusinessesScreen";
import { informalTradersRecordCode } from "./InformalTradersScreen";
import { homeEmpty, peopleRows } from "./PeopleScreens";
import { loadPerson, PersonPanel } from "./PersonScreen";

type Row = { id: string; title: string; meta: string };

const personKey = "person:";
const placeKey = "place:";

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
    loadAddresses().then((addresses) => kinded("address:", addresses.map((address) => ({ id: address.id, title: address.name, meta: address.place })))),
    loadPlaces().then((places) => kinded(placeKey, places.map((place) => ({ id: place.id, title: place.name, meta: place.category })))),
    loadRecordRows(businessesRecordCode, "Trading name", ["Kind of business", "Neighbourhood"]).then((rows) => kinded("business:", rows)),
    loadRecordRows(informalTradersRecordCode, "Name or alias", ["What is sold", "Neighbourhood"]).then((rows) => kinded("trader:", rows)),
  ]);

const startsWithAny = (id: unknown, kinds: string[]) => kinds.some((kind) => String(id).startsWith(kind));

const opensDetail = (item: Record<string, unknown>) => startsWithAny(item.id, [personKey, placeKey]);

export function SearchScreen() {
  const word = useWord("actor");
  const navigate = useNavigate();
  const here = useLocation();
  const [version, setVersion] = useState(0);
  const groups = (items: Record<string, unknown>[]) =>
    [
      { heading: word("People"), items: items.filter((item) => startsWithAny(item.id, [personKey])) },
      { heading: "Properties", items: items.filter((item) => startsWithAny(item.id, ["address:", placeKey])) },
      { heading: "Businesses", items: items.filter((item) => startsWithAny(item.id, ["business:"])) },
      { heading: "Informal traders", items: items.filter((item) => startsWithAny(item.id, ["trader:"])) },
    ].filter((group) => group.items.length > 0);
  const openPlace = (id: string) => {
    if (!id.startsWith(placeKey)) return false;
    navigate(placePaths.place.path({ placeId: id.slice(placeKey.length) }), { state: { from: { path: `${here.pathname}${here.search}`, title: "Search" } } });
    return true;
  };
  return (
    <MenuWindow
      title="Search"
      listKey={version}
      detailKey={version}
      elsewhere={openPlace}
      list={{ title: "Search", tool: "search", fields: { title: "title", meta: "meta" }, empty: homeEmpty("Nothing to search yet."), load: loadEverything, groups, opens: opensDetail }}
      detail={{
        tool: "actor_get_actor",
        load: (id) => loadPerson(id.slice(personKey.length)),
        fields: { Name: "display_name" },
        status: "status",
        extra: (person) => <PersonPanel person={person} onSaved={() => setVersion((was) => was + 1)} />,
      }}
    />
  );
}
