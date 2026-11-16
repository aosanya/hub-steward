import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../forms/useLoad";
import { routes } from "../../app/routes";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { useWide } from "../../shared/ui/useWide";
import { Shell } from "../../app/Shell";
import { mcpRisksClient, type RisksClient } from "./api";
import { RiskBody } from "./RiskBody";
import { RisksPage } from "./RisksPage";
import { labelOf } from "./labels";

function RiskScreen({ client, riskId }: { client: RisksClient; riskId: string }) {
  const { words } = useLanguage();
  const go = useNavigate();
  const loaded = useLoad(() => client.risk(riskId), `risk-${riskId}`);
  const back = () => go(routes.risks.path());

  if (loaded.state !== "ready") {
    return (
      <Shell title={words.risksTitle} onBack={back}>
        {loaded.state === "loading" ? <LoadingLine words={words.riskLoading} /> : <LoadFailed words={words.riskFailed} />}
      </Shell>
    );
  }

  return (
    <Shell title={loaded.data.risk.title} sub={labelOf(words, "status", loaded.data.risk.status)} onBack={back}>
      <RiskBody detail={loaded.data} />
    </Shell>
  );
}

export function RiskPage({ client = mcpRisksClient }: { client?: RisksClient }) {
  const { riskId = "" } = useParams();
  const wide = useWide();
  return wide ? <RisksPage client={client} riskId={riskId} /> : <RiskScreen client={client} riskId={riskId} />;
}
