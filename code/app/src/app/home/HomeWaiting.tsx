import { useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../Shell";
import { homeFailedWords, homeHeadWords } from "./AgencyHome";
import { backOf } from "./homeBack";
import { pathTo, titleIn } from "./homeDeclaration";
import type { HomeWiring } from "./homeFacts";
import { homePath } from "./homePaths";
import { useHomeDeclaration } from "./useHomeDeclaration";

export function HomeWaiting(_wiring: HomeWiring) {
  const { entryKey = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { code, words } = useLanguage();
  const [attempt, setAttempt] = useState(0);
  const declaration = useHomeDeclaration(attempt);
  if (declaration.state === "loading") return <Shell title={homeHeadWords}><LoadingLine words="Loading" /></Shell>;
  if (declaration.state === "error") return <Shell title={homeHeadWords}><LoadFailed words={homeFailedWords} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  const trail = pathTo(declaration.data, entryKey);
  const entry = trail.at(-1);
  if (entry?.target?.type !== "workflow") return <Navigate to={homePath()} replace />;
  const inPage = trail.some((node) => node.pageOf !== "");
  const back = backOf(trail.at(-2), inPage ? (search.get("row") ?? "") : "", code);
  return (
    <Shell title={titleIn(entry, code)} onBack={() => navigate(back.to)} backLabel={back.label}>
      <EmptyCard words={words.nothingWaiting} />
    </Shell>
  );
}
