import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { routes } from "../routes";
import { owesConsent } from "./api";
import { isSettled, settle } from "./settled";

type Checked = "checking" | "owed" | "clear";

function Gate({ agencyId, children }: { agencyId: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const [checked, setChecked] = useState<Checked>(isSettled(agencyId) ? "clear" : "checking");

  useEffect(() => {
    if (isSettled(agencyId)) return;
    let live = true;
    owesConsent(agencyId)
      .then((owed) => {
        if (!live) return;
        if (!owed) settle(agencyId);
        setChecked(owed ? "owed" : "clear");
      })
      .catch(() => live && setChecked("clear"));
    return () => {
      live = false;
    };
  }, [agencyId]);

  const consentPath = routes.consent.pathIn(agencyId, {});
  if (pathname === consentPath) return <>{children}</>;
  if (checked === "owed" && !isSettled(agencyId)) return <Navigate to={consentPath} replace />;
  return <>{children}</>;
}

export function ConsentGate({ children }: { children: ReactNode }) {
  const { agencyId = "" } = useParams();
  return (
    <Gate key={agencyId} agencyId={agencyId}>
      {children}
    </Gate>
  );
}
