import { useEffect, useState } from "react";
import { mcpAgencyClient, type AgencyClient, type AgencyView } from "../agency/modules";
import type { AgencyKind } from "../home/cards";
import { HomePage, type DoSomethingSegment } from "../pages/HomePage";
import { isApproved, mcpSupplyClient, mySupplier, resolveMember, type SupplyClient } from "./api";

export function SupplierHome({
  client = mcpSupplyClient,
  agency = mcpAgencyClient,
  me,
  segment,
}: {
  client?: SupplyClient;
  agency?: AgencyClient;
  me?: string;
  segment?: DoSomethingSegment;
}) {
  const [kind, setKind] = useState<AgencyKind | undefined>(undefined);
  const [view, setView] = useState<AgencyView | null>(null);
  useEffect(() => {
    let live = true;
    const kindOf = async (): Promise<AgencyKind> => {
      const read = await agency.read().catch(() => null);
      if (live) setView(read);
      const mine = mySupplier(await client.listSuppliers(), await resolveMember(me));
      if (!mine || !isApproved(mine)) return "farmers";
      return "supplier";
    };
    kindOf().then(
      (found) => live && setKind(found),
      () => live && setKind("farmers"),
    );
    return () => {
      live = false;
    };
  }, [client, agency, me]);
  return <HomePage kind={kind} view={view} segment={segment} />;
}
