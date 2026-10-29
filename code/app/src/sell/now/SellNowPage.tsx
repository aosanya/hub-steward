import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { priceWords, quantityLabel, unitWordsOf } from "../../market/unitWords";
import { mcpSellClient, type SellClient } from "./api";

const wholeBags = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : 0);

export function SellNowPage({ client = mcpSellClient }: { client?: SellClient }) {
  const { productId = "", offerId = "" } = useParams();
  const navigate = useNavigate();
  const loaded = useLoad(async () => (await client.listPrices(productId)).find((offer) => offer.id === offerId) ?? null, `${productId}-${offerId}`);
  const [bags, setBags] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const sell = async () => {
    const count = wholeBags(bags);
    if (count < 1) {
      setProblem(`Enter how many ${unitWordsOf(offer?.unit ?? "", 2)}`.trim() + ".");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      const sale = await client.sellNow(offerId, count);
      navigate(`/sell/sale/${sale.id}`);
    } catch {
      setProblem("Could not sell. Try again.");
      setBusy(false);
    }
  };

  const offer = loaded.state === "ready" ? loaded.data : null;

  return (
    <Shell title="Sell now" onBack={() => navigate(`/sell/${productId}`)}>
      {loaded.state === "error" || (loaded.state === "ready" && offer === null) ? <LoadFailed words="This price could not be found." /> : null}
      {offer ? (
        <>
          <Rows>
            <ListRow title={offer.buyer} meta={priceWords(offer.price, offer.unit)} />
          </Rows>
          <Field label={quantityLabel(offer.unit)} inputMode="numeric" value={bags} onChange={(e) => setBags(e.target.value)} error={problem} />
          <Button kind="primary" onClick={sell} disabled={busy}>
            Sell now
          </Button>
        </>
      ) : null}
    </Shell>
  );
}
