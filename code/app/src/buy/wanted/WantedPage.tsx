import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Shell } from "../../ui/Shell";
import { mcpWantedClient, type WantedClient } from "./api";
import { buyInputs } from "./buyInputs";
import { isListed } from "./unlisted";
import { wantedFrom, wantedQuery } from "./wantedQuery";
import "./notice.css";

export function WantedPage({ client = mcpWantedClient }: { client?: WantedClient }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const start = wantedFrom(params);
  const [what, setWhat] = useState(start.what);
  const [quantity, setQuantity] = useState(start.quantity);
  const [neededBy, setNeededBy] = useState(start.neededBy);
  const offers = useLoad(() => client.listOffers(), "offers");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const wanted = { what, quantity, neededBy };
  const quantityOk = quantity.trim() === "" || Number(quantity) > 0;
  const unlisted = what.trim() !== "" && offers.state === "ready" && !isListed(what, offers.data);
  const ready = what.trim() !== "" && quantityOk && !busy;

  const choose = async (file: () => Promise<string>, open: (id: string) => string) => {
    setBusy(true);
    setFailed(false);
    try {
      navigate(open(await file()));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Shell title="Something not listed" onBack={() => navigate(buyInputs)}>
      <Field label="What" value={what} onChange={(event) => setWhat(event.target.value)} />
      <Field
        label="How much"
        inputMode="decimal"
        value={quantity}
        error={quantityOk ? undefined : "Use a number."}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <Field label="Needed by" type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} />
      {unlisted ? (
        <div className="agent-says">
          <span className="who">
            <Chip>Agent</Chip>
          </span>
          <p className="bubble">{`No shop has listed ${what.trim()}.`}</p>
        </div>
      ) : null}
      <Button
        kind="primary"
        disabled={!ready}
        onClick={() => choose(() => client.createWanted(wanted), (id) => `/buy/wanted/${id}/ask?${wantedQuery(wanted)}`)}
      >
        Ask shops
      </Button>
      <Button disabled={!ready} onClick={() => choose(() => client.createNotice(wanted), (id) => `/buy/notices/${id}`)}>
        Put up a notice
      </Button>
      {failed ? <p role="alert">That was not sent. Try again.</p> : null}
    </Shell>
  );
}
