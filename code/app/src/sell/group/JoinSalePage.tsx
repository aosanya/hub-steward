import { useState } from "react";
import { doSomethingPath } from "../../routes";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { bags, termsWords } from "../../supply/groupOrder/api";
import { resolveMember } from "../../supply/api";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { dayWords } from "../../ui/days";
import { kes } from "../../market/money";
import { quantityLabel } from "../../market/unitWords";
import { JoinForm } from "../../ui/JoinForm";
import { Shell } from "../../ui/Shell";
import { isOpenSale, mcpSaleClient, ownLine, type Collection, type Sale, type SaleClient } from "./saleApi";

type Props = { client?: SaleClient; me?: string };

const farmers = (n: number) => `${n} ${n === 1 ? "farmer" : "farmers"}`;

function SaleCard({ sale }: { sale: Sale }) {
  return (
    <Card>
      <p className="ttl">{sale.productWords ? `${sale.productWords} group sale` : "Group sale"}</p>
      <p>{termsWords({ price: sale.price, minimum: sale.minimum })}</p>
      {sale.buyer ? <p>{sale.buyer}</p> : null}
      <p>{`${bags(sale.total)} so far · minimum ${bags(sale.minimum)} · ${farmers(sale.count)}`}</p>
    </Card>
  );
}

function JoinSale({ client, sale, me, onJoined }: { client: SaleClient; sale: Sale; me: string; onJoined: (sale: Sale) => void }) {
  const mine = ownLine(sale, me);
  const send = async (quantity: number) => onJoined(await client.join(sale.id, quantity));
  return <JoinForm label={quantityLabel("bag")} unit="bag" action={mine ? "Change" : "Join"} current={mine?.quantity} send={send} />;
}

function ConfirmedShare({ sale, quantity, collection }: { sale: Sale; quantity: number; collection: Collection }) {
  return (
    <Card>
      <Rows>
        <ListRow title="Status" end={<Chip tone="success">Confirmed</Chip>} />
        <ListRow title="Your share" end={bags(quantity)} />
        <ListRow title="Price" end={`${kes(sale.price)} a bag`} />
        <ListRow title="Total" end={kes(quantity * sale.price)} />
        {collection.date ? <ListRow title="Day to collect" end={dayWords(collection.date)} /> : null}
        {collection.note ? <ListRow title="Note" end={collection.note} /> : null}
      </Rows>
    </Card>
  );
}

function SaleView({ client, first, me, collection }: { client: SaleClient; first: Sale; me: string; collection: Collection }) {
  const [sale, setSale] = useState(first);
  const mine = ownLine(sale, me);
  const confirmed = sale.state === "closed" && mine !== undefined;
  return (
    <>
      <SaleCard sale={sale} />
      {confirmed ? <ConfirmedShare sale={sale} quantity={mine.quantity} collection={collection} /> : null}
      {mine && !confirmed ? (
        <Card>
          <p className="ttl">Your line</p>
          <p>{bags(mine.quantity)}</p>
          <Chip tone="success">Joined</Chip>
        </Card>
      ) : null}
      {isOpenSale(sale) ? (
        <JoinSale key={mine?.quantity ?? 0} client={client} sale={sale} me={me} onJoined={setSale} />
      ) : (
        <EmptyCard words="This group sale is closed." />
      )}
    </>
  );
}

export function JoinSalePage({ client = mcpSaleClient, me }: Props) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const loaded = useLoad(async () => {
    const sale = await client.getSale(orderId);
    const member = await resolveMember(me);
    const none: Collection = { date: "", note: "" };
    const collection = sale.state === "closed" && client.collection ? await client.collection(sale, member).catch(() => none) : none;
    return { sale, member, collection };
  }, `sale${orderId}`);
  return (
    <Shell title="Group sale" onBack={() => navigate(doSomethingPath())}>
      {loaded.state === "error" ? <LoadFailed words="This group sale could not be opened." /> : null}
      {loaded.state === "ready" ? <SaleView client={client} first={loaded.data.sale} me={loaded.data.member} collection={loaded.data.collection} /> : null}
    </Shell>
  );
}
