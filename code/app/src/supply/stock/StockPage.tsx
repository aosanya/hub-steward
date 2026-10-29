import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { Shell } from "../../ui/Shell";
import { isApproved, mcpSupplyClient, mySupplier, resolveMember, type SupplyClient } from "../api";
import { mcpStockClient, type StockClient } from "./api";

type Sheet = { supplierId: string; products: string[]; counts: Record<string, number> };

export function StockPage({
  client = mcpSupplyClient,
  stock = mcpStockClient,
  me,
  }: {
  client?: SupplyClient;
  stock?: StockClient;
  me?: string;
}) {
  const navigate = useNavigate();
  const sheet = useLoad<Sheet | null>(async () => {
    const mine = mySupplier(await client.listSuppliers(), await resolveMember(me));
    if (!isApproved(mine)) return null;
    const [offers, entries] = await Promise.all([client.listOffers(mine!.id), stock.getStock(mine!.id)]);
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.product] = e.count;
    const products = [...new Set([...offers.map((o) => o.product), ...entries.map((e) => e.product)])].filter((p) => p !== "");
    return { supplierId: mine!.id, products, counts };
  }, "stock");
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  useEffect(() => {
    if (sheet.state !== "ready" || !sheet.data) return;
    const start: Record<string, string> = {};
    for (const p of sheet.data.products) start[p] = String(sheet.data.counts[p] ?? 0);
    setTyped(start);
  }, [sheet.state]);

  const valid = (p: string) => /^\d+$/.test((typed[p] ?? "").trim());

  const save = async () => {
    if (sheet.state !== "ready" || !sheet.data) return;
    const data = sheet.data;
    if (!data.products.every(valid)) {
      setState("failed");
      return;
    }
    setState("saving");
    try {
      for (const p of data.products) await stock.setStock(data.supplierId, { product: p, count: Number(typed[p].trim()) });
      setState("saved");
    } catch {
      setState("failed");
    }
  };

  return (
    <Shell title="Stock list" onBack={() => navigate("/offers")}>
      {sheet.state === "error" ? <LoadFailed words="Your stock list could not be loaded." /> : null}
      {sheet.state === "ready" && sheet.data === null ? <EmptyCard words="The stock list opens once the group coordinator approves your application." /> : null}
      {sheet.state === "ready" && sheet.data && sheet.data.products.length === 0 ? (
        <EmptyCard words="No products yet">
          <p>Add an offer first, then count it here.</p>
          <Button kind="primary" onClick={() => navigate("/offers/new")}>
            Add an offer
          </Button>
        </EmptyCard>
      ) : null}
      {sheet.state === "ready" && sheet.data && sheet.data.products.length > 0 ? (
        <>
          <p className="meta">Only you see this list</p>
          {sheet.data.products.map((p) => (
            <Field
              key={p}
              label={`${p} (bags)`}
              inputMode="numeric"
              value={typed[p] ?? ""}
              error={valid(p) ? undefined : "Use a whole number"}
              onChange={(e) => {
                setTyped({ ...typed, [p]: e.target.value });
                setState("idle");
              }}
            />
          ))}
          {state === "failed" ? <p className="ferr">The list was not saved. Use whole numbers and try again.</p> : null}
          {state === "saved" ? <p className="meta">List saved</p> : null}
          <Button kind="primary" onClick={save} disabled={state === "saving"}>
            Save list
          </Button>
        </>
      ) : null}
    </Shell>
  );
}
