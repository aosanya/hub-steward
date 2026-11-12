import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { forgetOpenAgency, openAgency, openAgencyId, rememberAgencyName } from "../../agency/open";
import { entryClient } from "../../entry/api";
import type { AgencyScreen } from "../../routes";
import { tabPathIn, type Tab } from "../../tabs";

export function InAgency({ children }: { children: ReactNode }) {
  const { agencyId = "" } = useParams();
  const [refused, setRefused] = useState(false);
  if (!refused) openAgency(agencyId);

  useEffect(() => {
    let live = true;
    entryClient()
      .listAgencies()
      .then((agencies) => {
        if (!live) return;
        const found = agencies.find((agency) => agency.id === agencyId);
        if (found) {
          rememberAgencyName(found.name);
          return;
        }
        forgetOpenAgency();
        setRefused(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [agencyId]);

  return refused ? <Navigate to="/agencies" replace /> : <>{children}</>;
}

export function ToOpenAgency({ tab }: { tab: Tab }) {
  const agencyId = openAgencyId();
  const { search, state } = useLocation();
  return <Navigate to={agencyId ? `${tabPathIn(tab, agencyId)}${search}` : "/agencies"} state={state} replace />;
}

export function ToOpenAgencyScreen({ screen }: { screen: AgencyScreen }) {
  const agencyId = openAgencyId();
  const values = useParams();
  const { search, state } = useLocation();
  return <Navigate to={agencyId ? `${screen.pathIn(agencyId, values)}${search}` : "/agencies"} state={state} replace />;
}
