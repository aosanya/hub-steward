import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";
import { digitaltwinModule, joined, loadRecords, textOf } from "./records";

export const addressList = "digitaltwin_address_list";

const fields = { title: "name", meta: "place" };

const loadAddresses = () =>
  loadRecords(addressList, (address) => ({
    name: joined([textOf(address.street), textOf(address.number)], " "),
    place: joined([textOf(address.postcode), textOf(address.area)], " "),
  }));

export function AddressesPage() {
  const word = useWord("digitaltwin");
  return (
    <MountedMenuList
      module={digitaltwinModule}
      title={word("Addresses")}
      tool={addressList}
      fields={fields}
      empty={{ words: `No ${word("Addresses").toLowerCase()} yet.` }}
      load={loadAddresses}
    />
  );
}
