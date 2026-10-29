import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { ChoiceGroup, ChoiceRow } from "../../ui/ChoiceRow";
import { Shell } from "../../ui/Shell";
import { mcpWantedClient, type WantedClient } from "./api";
import { askTicked } from "./askTicked";
import { dayName } from "./dates";
import { wantedFrom } from "./wantedQuery";

export function AskShopsPage({ client = mcpWantedClient }: { client?: WantedClient }) {
  const { requestId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const wanted = wantedFrom(params);
  const shops = useLoad(() => client.listShops(), requestId);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = (id: string) =>
    setOff((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const ask = async () => {
    if (shops.state !== "ready") return;
    setBusy(true);
    setFailed(false);
    const ticked = new Set(shops.data.filter((shop) => !off.has(shop.id)).map((shop) => shop.id));
    const sent = await askTicked(client, requestId, wanted, shops.data, ticked);
    if (sent.failed === sent.asked) {
      setFailed(true);
      setBusy(false);
      return;
    }
    navigate(`/buy/wanted/${requestId}?${params.toString()}`);
  };

  const summary = [wanted.what, wanted.quantity, wanted.neededBy && `by ${dayName(wanted.neededBy)}`].filter(Boolean).join(" · ");
  const anyTicked = shops.state === "ready" && shops.data.some((shop) => !off.has(shop.id));

  return (
    <Shell title="Ask shops" sub={summary} onBack={() => navigate(`/buy/wanted?${params.toString()}`)}>
      {shops.state === "error" ? <LoadFailed words="The shops could not be loaded." /> : null}
      {shops.state === "ready" && shops.data.length === 0 ? <EmptyCard words="No shop is taking asks now." /> : null}
      {shops.state === "ready" && shops.data.length > 0 ? (
        <ChoiceGroup label="Shops">
          {shops.data.map((shop) => (
            <ChoiceRow key={shop.id} type="checkbox" label={shop.name} checked={!off.has(shop.id)} onChange={() => toggle(shop.id)} />
          ))}
        </ChoiceGroup>
      ) : null}
      <Button kind="primary" disabled={!anyTicked || busy} onClick={ask}>
        Ask the ticked shops
      </Button>
      {failed ? <p role="alert">The shops were not asked. Try again.</p> : null}
    </Shell>
  );
}
