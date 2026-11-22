import { useRef, useState } from "react";
import { useWide } from "../../shared/ui/useWide";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Shell } from "../Shell";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { liveRecordRowsTool } from "../menu/liveRecordRows";
import { listRowsOf, loadDeclaredRows, mayAddRowsTo, type DeclaredRow } from "../menu/declaredRecord";
import { AddAct } from "../menu/AddButton";
import { MenuWindow } from "../menu/MenuWindow";
import { HomeForThis } from "./HomeForThis";
import { HomeRecordTable } from "./HomeRecordTable";
import { HomeRowFacts } from "./HomeRowFacts";
import { HomeSectionWindow } from "./HomeSectionWindow";
import { findNode, pathTo } from "./homeDeclaration";
import { useHomeFacts, type HomeFacts, type HomeWiring } from "./homeFacts";
import { rowStepsOf, singularOf } from "./homeRowSteps";
import { shownNodes } from "./homeVisibility";
import { homePath, homeRowPagePath } from "./homePaths";
import { scopeQueryOf, useHomeRecordRoute, withQuery, type HomeRecordRoute } from "./homeRecordRoute";
import { useHomeRecord, type HomeRecordView } from "./useHomeRecord";

type Ready = HomeRecordView & { record: NonNullable<HomeRecordView["record"]> };

function Rows({ route, view, facts }: { route: HomeRecordRoute; view: Ready; facts: HomeFacts }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { record, where, pageKey, title, back } = view;
  const loaded = useRef<DeclaredRow[]>([]);
  const [count, setCount] = useState(0);
  const mayAdd = mayAddRowsTo(record);
  const newPath = withQuery(`${route.listPath}/new`, scopeQueryOf(route.scopeRowId));
  const load = async () => {
    loaded.current = where ? await loadDeclaredRows(record.code, where) : [];
    setCount(loaded.current.length);
    return listRowsOf(record, loaded.current);
  };
  return (
    <MenuWindow
      key={route.listUrl}
      title={title}
      back={{ onBack: () => navigate(back.to), backLabel: back.label }}
      bandless
      withTabs
      startAt={search.get("open") ?? undefined}
      above={count > 0 && mayAdd ? <AddAct label="Add" to={newPath} /> : undefined}
      elsewhere={pageKey ? () => true : undefined}
      leave={pageKey ? (id) => navigate(homeRowPagePath(pageKey, id)) : undefined}
      list={{ title, tool: liveRecordRowsTool, fields: { title: "title", meta: "meta" }, empty: { words: "Nothing here yet.", ...(mayAdd ? { act: "Add", to: newPath } : {}) }, load }}
      detail={{
        tool: liveRecordRowsTool,
        fields: {},
        status: "",
        load: async (id) => ({ row: loaded.current.find((one) => one.id === id) ?? null, position: loaded.current.findIndex((one) => one.id === id) + 1 }),
        extra: (item) => {
          const row = item.row as DeclaredRow | null;
          if (!row) return null;
          const steps = rowStepsOf(view.declared, facts, route.entryKey, record.code, record.workflowId);
          return (
            <>
              <HomeRowFacts record={record} row={row} position={Number(item.position)} editTo={mayAdd ? withQuery(`${route.listPath}/${row.id}/edit`, scopeQueryOf(route.scopeRowId)) : undefined} />
              <HomeForThis thing={singularOf(record.name)} nodes={[...steps.tied, ...steps.pageEntries]} facts={facts} row={{ rowId: row.id, orderId: row.orderId }} from={{ path: route.listUrl, title }} />
            </>
          );
        },
      }}
    />
  );
}

export type HomeRecordRowsProps = Record<string, unknown>;

export function HomeRecordRows(wiring: HomeRecordRowsProps) {
  const route = useHomeRecordRoute();
  if (!route) return null;
  return <Loaded route={route} wiring={wiring as HomeWiring} />;
}

function WithFacts({ route, view, wiring }: { route: HomeRecordRoute; view: Ready; wiring: HomeWiring }) {
  const navigate = useNavigate();
  const wide = useWide();
  const [attempt, setAttempt] = useState(0);
  const facts = useHomeFacts(view.declared, wiring, attempt);
  if (facts.state === "loading") return <Shell title="" onBack={() => navigate(view.back.to)} backLabel={view.back.label} tabless><LoadingLine /></Shell>;
  if (facts.state === "error") return <Shell title="" onBack={() => navigate(view.back.to)} backLabel={view.back.label} tabless><LoadFailed words={facts.words} onRetry={() => setAttempt(attempt + 1)} /></Shell>;
  const root = wide && view.rootKey && !route.scopeRowId ? findNode(shownNodes(view.declared, facts.data), view.rootKey) : undefined;
  if (!root) return <Rows route={route} view={view} facts={facts.data} />;
  const opened = pathTo(root.entries, route.entryKey).slice(0, -1).map((node) => node.key);
  return (
    <HomeSectionWindow root={root} facts={facts.data} selectedKey={route.entryKey} opened={opened}>
      <HomeRecordTable route={route} record={view.record} where={view.where} title={view.title} declared={view.declared} facts={facts.data} />
    </HomeSectionWindow>
  );
}

function Loaded({ route, wiring }: { route: HomeRecordRoute; wiring: HomeWiring }) {
  const navigate = useNavigate();
  const view = useHomeRecord(route);
  if (view.state === "ready" && view.data === null) return <Navigate to={homePath()} replace />;
  if (view.state !== "ready" || !view.data?.record) {
    const back = view.state === "ready" && view.data ? view.data.back : { to: homePath(), label: "Home" };
    return (
      <Shell title="" onBack={() => navigate(back.to)} backLabel={back.label} tabless>
        {view.state === "loading" ? <LoadingLine /> : <LoadFailed words="This could not be loaded." />}
      </Shell>
    );
  }
  return <WithFacts route={route} view={{ ...view.data, record: view.data.record }} wiring={wiring} />;
}
