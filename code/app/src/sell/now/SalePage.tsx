import { useEffect, useRef, useState } from "react";
import { doSomethingPath } from "../../routes";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { kes } from "../../supply/api";
import { dayWords } from "../../ui/days";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { Chip, type ChipTone } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { priceWords, quantityWords } from "../../market/unitWords";
import { mcpSellClient, nameOfProduct, saleTotal, statusOf, type Sale, type SaleStatus, type SellClient } from "./api";
import { canCancelSale, mcpSaleActions, type SaleActions } from "./cancel";

const toneOf: Record<SaleStatus, ChipTone | undefined> = { Waiting: undefined, Yes: "success", No: "danger", Cancelled: undefined };

const sentence = (sale: Sale, status: SaleStatus, name: string) => {
  const what = `${quantityWords(sale.quantity, sale.unit)} of ${name}`;
  if (status === "Waiting") return `I asked ${sale.buyer} once about ${what}. His yes is his own.`;
  if (status === "Yes") return `${sale.buyer} said yes.`;
  if (status === "No") return `${sale.buyer} said no.`;
  return `${sale.buyer} will not take ${what}.`;
};

export function SalePage({ client = mcpSellClient, actions = mcpSaleActions }: { client?: SellClient; actions?: SaleActions }) {
  const { saleId = "" } = useParams();
  const navigate = useNavigate();
  const [reloads, setReloads] = useState(0);
  const loaded = useLoad(async () => {
    const found = await client.getSale(saleId);
    const prices = await client.listPrices(found.product).catch(() => []);
    return { sale: found, name: nameOfProduct(found.product, prices) };
  }, `sale-${saleId}-${reloads}`);
  const [cancelled, setCancelled] = useState<Sale | null>(null);
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState(false);
  const sale = cancelled ?? (loaded.state === "ready" ? loaded.data.sale : null);
  const name = loaded.state === "ready" ? loaded.data.name : "";
  const status = sale ? statusOf(sale) : null;

  const booked = useRef("");
  useEffect(() => {
    if (!sale || sale.answer !== "yes" || sale.yesId === "" || sale.orderId !== "" || booked.current === sale.yesId) return;
    booked.current = sale.yesId;
    client.bookSale(sale).then(
      () => setReloads((n) => n + 1),
      () => {
        booked.current = "";
        setFailed("Could not make the sale from his yes. Try again.");
      },
    );
  }, [sale?.yesId, sale?.orderId]);

  const cancel = async () => {
    setBusy(true);
    setFailed("");
    try {
      setCancelled(await actions.cancelSale(sale!));
    } catch {
      setFailed("Could not cancel the sale. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={sale ? `${quantityWords(sale.quantity, sale.unit)} of ${name || sale.product}` : "Sale"} onBack={() => navigate(sale ? `/sell/${sale.product}` : doSomethingPath())}>
      {loaded.state === "error" ? <LoadFailed words="This sale could not be loaded." /> : null}
      {sale && status ? (
        <>
          <p>{cancelled ? `You cancelled the sale to ${sale.buyer}.` : sentence(sale, status, name || sale.product)}</p>
          <Rows>
            <ListRow title="Buyer" meta={sale.buyer} />
            <ListRow title="Status" end={<Chip tone={toneOf[status]}>{status}</Chip>} />
            <ListRow title="Price" meta={`${priceWords(sale.unitPrice, sale.unit)}, the price when you sold`} />
            <ListRow title="In all" meta={kes(saleTotal(sale))} />
            {sale.promisedDate ? <ListRow title="His date" meta={dayWords(sale.promisedDate)} /> : null}
          </Rows>
          {failed ? <p role="alert">{failed}</p> : null}
          {canCancelSale(sale) ? (
            <Button onClick={cancel} disabled={busy}>
              Cancel the sale
            </Button>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}
