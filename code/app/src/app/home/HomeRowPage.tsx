import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../../features/forms/useLoad";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { loadDeclaredRecord, loadDeclaredRows, type DeclaredRecord, type DeclaredRow } from "../menu/declaredRecord";
import { Shell } from "../Shell";
import { homeHeadWords, homeFailedWords } from "./AgencyHome";
import { HomeNodeRows } from "./HomeNodeRows";
import { HomeRowFacts } from "./HomeRowFacts";
import { findNode, pathTo, titleIn, type HomeNode } from "./homeDeclaration";
import { useHomeFacts, type HomeFacts, type HomeWiring } from "./homeFacts";
import { homePath, homeRecordPath, homeRowPagePath } from "./homePaths";
import { shownNodes } from "./homeVisibility";
import { useHomeDeclaration } from "./useHomeDeclaration";

type Given = { inKey: string; code: string; rowId: string; key: string };

type Loaded = { declared: HomeNode[]; facts: HomeFacts; record: DeclaredRecord; row: DeclaredRow; position: number };

const loadRow = async (code: string, rowId: string) => {
  const [record, rows] = await Promise.all([loadDeclaredRecord(code), loadDeclaredRows(code, [])]);
  const at = rows.findIndex((row) => row.id === rowId);
  return record && at >= 0 ? { record, row: rows[at], position: at + 1 } : null;
};

function PageBody({ given, loaded }: { given: Given; loaded: Loaded }) {
  const navigate = useNavigate();
  const { code } = useLanguage();
  const page = pathTo(loaded.declared, given.key).find((node) => node.pageOf === given.code);
  const shownInPage = page ? shownNodes(page.entries, loaded.facts) : [];
  const node = page && (page.key === given.key ? page : findNode(shownInPage, given.key));
  if (!page || !node) return <Navigate to={homePath()} replace />;
  const onPage = node.key === page.key;
  const parent = onPage ? undefined : pathTo(loaded.declared, node.key).at(-2);
  const entries = onPage ? shownInPage : node.entries;
  const row = { inKey: given.inKey, code: given.code, rowId: given.rowId, pageKey: page.key };
  const from = { path: homeRowPagePath(given.inKey, given.code, given.rowId, node.key), title: titleIn(node, code) };
  return (
    <Shell
      title={titleIn(node, code)}
      onBack={() => navigate(parent ? homeRowPagePath(given.inKey, given.code, given.rowId, parent.key) : homeRecordPath(given.inKey, given.code))}
      backLabel={parent ? titleIn(parent, code) : loaded.record.name}
    >
      {onPage ? <HomeRowFacts record={loaded.record} row={loaded.row} position={loaded.position} /> : null}
      <HomeNodeRows nodes={entries} facts={loaded.facts} parentKey={node.key} row={row} from={from} />
    </Shell>
  );
}

function PageFacts({ given, declared, wiring }: { given: Given; declared: HomeNode[]; wiring: HomeWiring }) {
  const [attempt, setAttempt] = useState(0);
  const facts = useHomeFacts(declared, wiring, attempt);
  const row = useLoad(() => loadRow(given.code, given.rowId), `home-row-page:${openAgencyId()}:${given.code}:${given.rowId}:${attempt}`);
  if (facts.state === "error") return <Shell title={homeHeadWords}><LoadFailed words={facts.words} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  if (row.state === "error") return <Shell title={homeHeadWords}><LoadFailed words={homeFailedWords} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  if (facts.state === "loading" || row.state === "loading") return <Shell title={homeHeadWords}><LoadingLine words="Loading" /></Shell>;
  if (row.data === null) return <Navigate to={homeRecordPath(given.inKey, given.code)} replace />;
  return <PageBody given={given} loaded={{ declared, facts: facts.data, ...row.data }} />;
}

export function HomeRowPage(wiring: HomeWiring) {
  const { inKey = "", code = "", rowId = "", key = "" } = useParams();
  const [attempt, setAttempt] = useState(0);
  const declaration = useHomeDeclaration(attempt);
  if (declaration.state === "loading") return <Shell title={homeHeadWords}><LoadingLine words="Loading" /></Shell>;
  if (declaration.state === "error") return <Shell title={homeHeadWords}><LoadFailed words={homeFailedWords} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  return <PageFacts given={{ inKey, code, rowId, key }} declared={declaration.data} wiring={wiring} />;
}
