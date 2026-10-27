import { useCallback, useEffect, useState } from "react";
import { hiddenPages } from "../../data/menu";
import { pageModule } from "../../data/registry";
import type { PageModule, Query } from "../../data/types";
import { useReportLoading } from "../../shell/loadingContext";
import type { PageRow, PageSpec } from "../../types";

export type SpecPageState =
  | { kind: "loading" }
  | { kind: "planned" }
  | { kind: "ready"; spec: PageSpec; rows: PageRow[] | null };

const roomPages = ["alerts", "operations"];

const rowsQuery = (page: string, room: string | undefined): Query => ({
  ...(page === "alerts" ? { state: "open" } : {}),
  ...(room && roomPages.includes(page) ? { room } : {}),
});

async function loadRows(module: PageModule, hubId: string, page: string, room: string | undefined): Promise<PageRow[] | null> {
  try {
    return await module.rows(hubId, rowsQuery(page, room));
  } catch {
    return null;
  }
}

async function loadSpecPage(hubId: string, page: string, room: string | undefined): Promise<SpecPageState> {
  const module = pageModule(page);
  if (hiddenPages.includes(page) || !module?.spec?.id) return { kind: "planned" };
  return { kind: "ready", spec: module.spec, rows: await loadRows(module, hubId, page, room) };
}

export function useSpecPage(hubId: string, page: string, room?: string): { state: SpecPageState; reload: () => void } {
  const [state, setState] = useState<SpecPageState>({ kind: "loading" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    loadSpecPage(hubId, page, room).then((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
    };
  }, [hubId, page, room, round]);

  useReportLoading(state.kind === "loading");

  const reload = useCallback(() => setRound((n) => n + 1), []);

  return { state, reload };
}
