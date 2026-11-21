import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shell } from "../Shell";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { liveRecordRowsTool } from "../menu/liveRecordRows";
import { listRowsOf, loadDeclaredRows, mayAddRowsTo, type DeclaredRow } from "../menu/declaredRecord";
import { AddAct } from "../menu/AddButton";
import { MenuWindow } from "../menu/MenuWindow";
import { HomeRowFacts } from "./HomeRowFacts";
import { useHomeRecordRoute } from "./homeRecordRoute";
import { useHomeRecord, type HomeRecordView } from "./useHomeRecord";
import type { HomeRecordRoute } from "./homeRecordRoute";

const entrySuffix = (route: HomeRecordRoute) => (route.entryKey ? `?entry=${encodeURIComponent(route.entryKey)}` : "");

function Rows({ route, view }: { route: HomeRecordRoute; view: HomeRecordView & { record: NonNullable<HomeRecordView["record"]> } }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { record, where, pageKey, title, back } = view;
  const loaded = useRef<DeclaredRow[]>([]);
  const [count, setCount] = useState(0);
  const mayAdd = mayAddRowsTo(record);
  const newPath = `${route.listPath}/new${entrySuffix(route)}`;
  const load = async () => {
    loaded.current = where ? await loadDeclaredRows(record.code, where) : [];
    setCount(loaded.current.length);
    return listRowsOf(record, loaded.current);
  };
  return (
    <MenuWindow
      key={route.listPath}
      title={title}
      back={{ onBack: () => navigate(back.to), backLabel: back.label }}
      bandless
      withTabs
      startAt={search.get("row") ?? undefined}
      above={count > 0 && mayAdd ? <AddAct label="Add" to={newPath} /> : undefined}
      elsewhere={pageKey ? () => true : undefined}
      leave={pageKey ? (id) => navigate(`${route.listPath}/${id}/${pageKey}`) : undefined}
      list={{ title, tool: liveRecordRowsTool, fields: { title: "title", meta: "meta" }, empty: { words: "Nothing here yet.", ...(mayAdd ? { act: "Add", to: newPath } : {}) }, load }}
      detail={{
        tool: liveRecordRowsTool,
        fields: {},
        status: "",
        load: async (id) => ({ row: loaded.current.find((one) => one.id === id) ?? null, position: loaded.current.findIndex((one) => one.id === id) + 1 }),
        extra: (item) => {
          const row = item.row as DeclaredRow | null;
          return row ? <HomeRowFacts record={record} row={row} position={Number(item.position)} editTo={mayAdd ? `${route.listPath}/${row.id}/edit${entrySuffix(route)}` : undefined} /> : null;
        },
      }}
    />
  );
}

export type HomeRecordRowsProps = Record<string, unknown>;

export function HomeRecordRows(_wiring: HomeRecordRowsProps) {
  const route = useHomeRecordRoute();
  if (!route) return null;
  return <Loaded route={route} />;
}

function Loaded({ route }: { route: HomeRecordRoute }) {
  const navigate = useNavigate();
  const view = useHomeRecord(route);
  if (view.state !== "ready" || !view.data.record) {
    const back = view.state === "ready" ? view.data.back : { to: `${route.agencyBase}/home`, label: "Home" };
    return (
      <Shell title="" onBack={() => navigate(back.to)} backLabel={back.label} tabless>
        {view.state === "loading" ? <LoadingLine /> : <LoadFailed words="This could not be loaded." />}
      </Shell>
    );
  }
  return <Rows route={route} view={{ ...view.data, record: view.data.record }} />;
}
