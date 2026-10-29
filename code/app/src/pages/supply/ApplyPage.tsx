import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { isApproved, mcpSupplyClient, mySupplier, resolveMember, waitingWords, type SupplyClient } from "../../supply/api";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";

export function ApplyPage({ client = mcpSupplyClient, me }: { client?: SupplyClient; me?: string }) {
  const navigate = useNavigate();
  const [round, setRound] = useState(0);
  const suppliers = useLoad(async () => ({ all: await client.listSuppliers(), who: await resolveMember(me) }), `suppliers${round}`);
  const mine = suppliers.state === "ready" ? mySupplier(suppliers.data.all, suppliers.data.who) : undefined;
  const waitingOn = useLoad(
    async () => (mine && !isApproved(mine) && client.listCoordinators ? await client.listCoordinators().catch(() => []) : []),
    `coordinators${mine?.id ?? ""}${mine?.status ?? ""}`,
  );
  const [shop, setShop] = useState("");
  const [area, setArea] = useState("");
  const [sells, setSells] = useState("");
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);

  const send = async () => {
    if (shop.trim() === "") {
      setMissing(true);
      return;
    }
    setMissing(false);
    setFailed(false);
    try {
      await client.applySupplier({ shop: shop.trim(), area: area.trim(), sells: sells.trim() });
      setRound((n) => n + 1);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Shell title={mine ? "Your application" : "Apply as a supplier"} onBack={() => navigate("/")}>
      {suppliers.state === "error" ? <LoadFailed words="Your application could not be loaded." /> : null}
      {mine ? (
        <Rows>
          <ListRow title={mine.shop} meta={[mine.area, mine.sells].filter(Boolean).join(" · ")} end={isApproved(mine) ? "Approved" : "Asked"} />
          <ListRow
            title={isApproved(mine) ? "You are approved as a supplier" : waitingWords(waitingOn.state === "ready" ? waitingOn.data : [])}
            meta={isApproved(mine) ? (mine.approvedByName !== "" ? `Approved by ${mine.approvedByName}` : "") : "Waiting"}
          />
          {isApproved(mine) ? <ListRow title="Offers" end="›" onClick={() => navigate("/offers")} /> : null}
        </Rows>
      ) : null}
      {suppliers.state === "ready" && !mine ? (
        <Card>
          <Field label="Shop name" value={shop} onChange={(e) => setShop(e.target.value)} error={missing ? "Say the name of your shop." : undefined} />
          <Field label="Area" value={area} onChange={(e) => setArea(e.target.value)} />
          <Field label="What you sell" value={sells} onChange={(e) => setSells(e.target.value)} />
          {failed ? <p className="ferr">Your application was not sent. Try again.</p> : null}
          <Button kind="primary" onClick={send}>
            Send application
          </Button>
        </Card>
      ) : null}
    </Shell>
  );
}
