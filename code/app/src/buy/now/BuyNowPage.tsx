import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { priceWords, unitWordsOf } from "../../market/unitWords";
import { routes } from "../../routes";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { Shell } from "../../ui/Shell";
import { mcpBuyNowClient, type BuyNowClient } from "./api";

export function BuyNowPage({ client = mcpBuyNowClient }: { client?: BuyNowClient }) {
  const navigate = useNavigate();
  const { productId = "", offerId = "" } = useParams();
  const yesId = useSearchParams()[0].get("yes") ?? "";
  const loaded = useLoad(() => client.getOffer(offerId), `offer-${offerId}`);
  const [bags, setBags] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const quantity = Number(bags);
  const valid = Number.isInteger(quantity) && quantity > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setFailed(false);
    try {
      const order = await client.buyNow(offerId, quantity, yesId || undefined);
      navigate(routes.marketOrder.path({ orderId: order.id }), { state: { neededBy } });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Shell title="Buy now" onBack={() => navigate(routes.product.path({ productId }))}>
      {loaded.state === "error" ? <LoadFailed words="This offer could not be loaded." /> : null}
      {loaded.state === "ready" ? (
        <form onSubmit={submit}>
          <p>
            {loaded.data.words} · {loaded.data.shop} · {priceWords(loaded.data.unitPrice, loaded.data.unit)}
          </p>
          <Field label={`How many ${unitWordsOf(loaded.data.unit, 2)}`.trim()} type="number" min={1} value={bags} onChange={(e) => setBags(e.target.value)} />
          <Field label="Needed by" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          {failed ? <p role="alert">Could not place this order. Try again.</p> : null}
          <Button kind="primary" type="submit" disabled={!valid || busy}>
            Buy now
          </Button>
        </form>
      ) : null}
    </Shell>
  );
}
