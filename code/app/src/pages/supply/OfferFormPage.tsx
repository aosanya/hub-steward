import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { isApproved, mcpSupplyClient, mySupplier, correctedGroup, productSlug, resolveMember, type SupplyClient, type SupplyOffer } from "../../supply/api";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { Shell } from "../../ui/Shell";

type Loaded = { supplierId: string; products: string[]; offer?: SupplyOffer } | null;

const num = (s: string) => {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export function OfferFormPage({ client = mcpSupplyClient, me, buyer = false }: { client?: SupplyClient; me?: string; buyer?: boolean }) {
  const navigate = useNavigate();
  const base = buyer ? "/prices" : "/offers";
  const { offerId } = useParams();
  const loaded = useLoad<Loaded>(async () => {
    const mine = mySupplier(await client.listSuppliers(), await resolveMember(me));
    if (!mine || !isApproved(mine)) return null;
    const products = await client.listProducts?.().catch(() => []) ?? [];
    if (!offerId) return { supplierId: mine.id, products };
    const offer = (await client.listOffers(mine.id)).find((o) => o.id === offerId);
    return offer ? { supplierId: mine.id, products, offer } : null;
  }, `form${offerId ?? ""}`);

  return (
    <Shell title={buyer ? (offerId ? "Edit price" : "Post a price") : offerId ? "Edit offer" : "Add an offer"} onBack={() => navigate(base)}>
      {loaded.state === "error" || (loaded.state === "ready" && loaded.data === null) ? <LoadFailed words={buyer ? "This price could not be opened." : "This offer could not be opened."} /> : null}
      {loaded.state === "ready" && loaded.data ? (
        <Form key={loaded.data.offer?.id ?? "new"} client={client} supplierId={loaded.data.supplierId} products={loaded.data.products} offer={loaded.data.offer} buyer={buyer} done={() => navigate(base)} />
      ) : null}
    </Shell>
  );
}

function Form({ client, supplierId, products, offer, buyer, done }: { client: SupplyClient; supplierId: string; products: string[]; offer?: SupplyOffer; buyer: boolean; done: () => void }) {
  const [product, setProduct] = useState(offer?.product ?? "");
  const [unit, setUnit] = useState(offer?.unit ?? "");
  const [price, setPrice] = useState(offer ? String(offer.price) : "");
  const [bulkFrom, setBulkFrom] = useState(offer && offer.bulkFrom ? String(offer.bulkFrom) : "");
  const [bulkPrice, setBulkPrice] = useState(offer && offer.bulkPrice ? String(offer.bulkPrice) : "");
  const [problem, setProblem] = useState("");

  const save = async () => {
    const draft = {
      product: product.trim(),
      group: offer?.group && offer.product === product.trim() ? correctedGroup(offer.product, offer.group) : productSlug(product, products),
      unit: unit.trim(),
      price: num(price),
      bulkFrom: bulkFrom.trim() === "" ? 0 : num(bulkFrom),
      bulkPrice: bulkPrice.trim() === "" ? 0 : num(bulkPrice),
    };
    if (draft.product === "") return setProblem("Say the product in your words.");
    if (!(draft.price > 0)) return setProblem("Give the price as a number.");
    if (Number.isNaN(draft.bulkFrom) || Number.isNaN(draft.bulkPrice)) return setProblem("Bulk from and bulk price are numbers.");
    if ((draft.bulkFrom > 0) !== (draft.bulkPrice > 0)) return setProblem("Give both bulk from and bulk price, or neither.");
    setProblem("");
    try {
      if (offer) await client.updateOffer({ ...offer, ...draft });
      else await client.createOffer(supplierId, draft);
      done();
    } catch {
      setProblem(buyer ? "The price was not saved. Try again." : "The offer was not saved. Try again.");
    }
  };

  return (
    <Card>
      <Field label="Product, in your words" value={product} onChange={(e) => setProduct(e.target.value)} />
      <Field label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <Field label="Price (KES)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Field label="Bulk from" inputMode="decimal" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} />
      <Field label="Bulk price (KES)" inputMode="decimal" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
      {problem ? <p className="ferr">{problem}</p> : null}
      <Button kind="primary" onClick={save}>
        {buyer ? "Post price" : "Save offer"}
      </Button>
    </Card>
  );
}
