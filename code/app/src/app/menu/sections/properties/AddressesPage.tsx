import { useWord } from "../../../../features/agency/useWord";
import { PageFrame } from "../../PageFrame";
import { ChatAboutProperty } from "./ChatAboutProperty";
import { FactsCard } from "../../FactsCard";
import { placePaths } from "./paths";
import { MountedMenuList } from "./MountedMenuList";
import { digitaltwinModule, joined, loadRecords, readRecord, textOf } from "./records";

export const addressList = "digitaltwin_address_list";

const fields = { title: "name", meta: "place" };

export const loadAddresses = () =>
  loadRecords(addressList, (address) => ({
    name: joined([textOf(address.street), textOf(address.number)], " "),
    place: joined([textOf(address.postcode), textOf(address.area)], " "),
  }));

const addressRead = "digitaltwin_address_read";

function AddressCards({ address }: { address: Record<string, unknown> }) {
  const word = useWord("digitaltwin");
  const id = textOf(address.id);
  const title = joined([textOf(address.street), textOf(address.number)], " ");
  return (
    <>
      <ChatAboutProperty kind="address" id={id} name={title} back={placePaths.addresses.path()} />
      <PageFrame title={title} line={joined([textOf(address.postcode), textOf(address.area)], " ")}>
        <FactsCard word={`${word("Address")} detail`} facts={[["Street", textOf(address.street)], ["Number", textOf(address.number)], ["Area", textOf(address.area)], ["Postcode", textOf(address.postcode)]]} />
      </PageFrame>
    </>
  );
}

export const addressFields = { Street: "street", Number: "number", Area: "area", Postcode: "postcode" };

export const addressDetail = {
  tool: addressRead,
  fields: {},
  status: "",
  load: (id: string) => readRecord(addressRead, "addressID", id),
  extra: (address: Record<string, unknown>) => <AddressCards address={address} />,
};

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
      detail={addressDetail}
    />
  );
}
