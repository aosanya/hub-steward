import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { useLoad } from "../../features/forms/useLoad";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { loadDeclaredRecord, loadDeclaredRows, type DeclaredRecord, type DeclaredRow } from "../menu/declaredRecord";
import { Shell } from "../Shell";
import { homeHeadWords, homeFailedWords } from "./AgencyHome";
import { HomeForThis } from "./HomeForThis";
import { HomeNodeRows } from "./HomeNodeRows";
import { HomeRowFacts } from "./HomeRowFacts";
import { homeTab } from "../tabs";
import { findNode, pathTo, titleIn, type HomeNode } from "./homeDeclaration";
import { useHomeFacts, type HomeFacts, type HomeWiring } from "./homeFacts";
import { homePath, homeRecordPath, homeRowPagePath } from "./homePaths";
import { rowStepsOf, singularOf } from "./homeRowSteps";
import { shownEntriesIn, shownNodes } from "./homeVisibility";
import { useHomeDeclaration } from "./useHomeDeclaration";

type Given = { code: string; rowId: string; key: string };

type Loaded = { declared: HomeNode[]; facts: HomeFacts; record: DeclaredRecord; row: DeclaredRow; position: number };

const loadRow = async (code: string, rowId: string) => {
  const [record, rows] = await Promise.all([loadDeclaredRecord(code), loadDeclaredRows(code, [])]);
  const at = rows.findIndex((row) => row.id === rowId);
  return record && at >= 0 ? { record, row: rows[at], position: at + 1 } : null;
};

const pageOfKey = (declared: HomeNode[], key: string) => pathTo(declared, key).filter((node) => node.pageOf !== "").at(-1);

const entryOfRecord = (loaded: Loaded, code: string) => {
  const entries = shownEntriesIn(loaded.declared, loaded.facts).filter((node) => node.target?.type === "record" && node.target.ref === code);
  return entries.find((node) => !node.target?.where.some((condition) => typeof condition.value !== "string")) ?? entries[0];
};

function PageBody({ given, loaded }: { given: Given; loaded: Loaded }) {
  const navigate = useNavigate();
  const { code } = useLanguage();
  const page = pageOfKey(loaded.declared, given.key);
  const shownInPage = page ? shownNodes(page.entries, loaded.facts) : [];
  const node = page && (page.key === given.key ? page : findNode(shownInPage, given.key));
  if (!page || !node) return <Navigate to={homePath()} replace />;
  const onPage = node.key === page.key;
  const parent = onPage ? undefined : pathTo(loaded.declared, node.key).at(-2);
  const entries = onPage ? shownInPage : node.entries;
  const recordEntry = entryOfRecord(loaded, given.code);
  const row = { rowId: given.rowId, orderId: loaded.row.orderId };
  const tied = onPage && recordEntry ? rowStepsOf(loaded.declared, loaded.facts, recordEntry.key, given.code, loaded.record.workflowId).tied : [];
  const from = { path: homeRowPagePath(node.key, given.rowId), title: titleIn(node, code) };
  const backPath = parent ? homeRowPagePath(parent.key, given.rowId) : recordEntry ? homeRecordPath(recordEntry.key, given.code) : homePath();
  const backWords = parent ? titleIn(parent, code) : recordEntry ? titleIn(recordEntry, code) : homeTab.label;
  return (
    <Shell
      title={titleIn(node, code)}
      onBack={() => navigate(backPath)}
      backLabel={backWords}
    >
      {onPage ? <HomeRowFacts record={loaded.record} row={loaded.row} position={loaded.position} /> : null}
      {onPage ? (
        <HomeForThis thing={singularOf(loaded.record.name)} nodes={[...tied, ...entries]} facts={loaded.facts} row={row} from={from} />
      ) : (
        <HomeNodeRows nodes={entries} facts={loaded.facts} row={row} from={from} />
      )}
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
  if (row.data === null) return <Navigate to={homePath()} replace />;
  return <PageBody given={given} loaded={{ declared, facts: facts.data, ...row.data }} />;
}

export function HomeRowPage(wiring: HomeWiring) {
  const { rowId = "", key = "" } = useParams();
  const [attempt, setAttempt] = useState(0);
  const declaration = useHomeDeclaration(attempt);
  if (declaration.state === "loading") return <Shell title={homeHeadWords}><LoadingLine words="Loading" /></Shell>;
  if (declaration.state === "error") return <Shell title={homeHeadWords}><LoadFailed words={homeFailedWords} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  const page = pageOfKey(declaration.data, key);
  if (!page) return <Navigate to={homePath()} replace />;
  return <PageFacts given={{ code: page.pageOf, rowId, key }} declared={declaration.data} wiring={wiring} />;
}
