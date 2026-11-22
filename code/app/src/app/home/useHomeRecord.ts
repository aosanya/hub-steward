import { useLoad } from "../../features/forms/useLoad";
import { useLanguage } from "../../shared/language/language";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { loadDeclaredRecord, loadDeclaredRows, resolveWhere, type DeclaredRecord, type PlainCondition } from "../menu/declaredRecord";
import { backOf } from "./homeBack";
import { pathTo, readHome, titleIn, type HomeNode } from "./homeDeclaration";
import type { HomeRecordRoute } from "./homeRecordRoute";

export type HomeRecordView = {
  record: DeclaredRecord | null;
  title: string;
  where: PlainCondition[] | null;
  pageKey: string | null;
  declared: HomeNode[];
  rootKey: string | null;
  back: { to: string; label: string };
};

const pageKeyOf = (nodes: HomeNode[], code: string): string | null => {
  for (const node of nodes) {
    if (node.pageOf === code) return node.key;
    const inside = pageKeyOf(node.entries, code);
    if (inside) return inside;
  }
  return null;
};

const loadView = async (route: HomeRecordRoute, languageCode: string): Promise<HomeRecordView | null> => {
  const nodes = await readHome();
  const trail = pathTo(nodes, route.entryKey);
  const entry = trail.at(-1);
  if (!entry || entry.target?.type !== "record" || entry.target.ref !== route.code) return null;
  const page = trail.slice(0, -1).reverse().find((node) => node.pageOf !== "");
  const [record, scopeRows] = await Promise.all([loadDeclaredRecord(route.code), page && route.scopeRowId ? loadDeclaredRows(page.pageOf, []) : Promise.resolve([])]);
  const scopeRow = scopeRows.find((row) => row.id === route.scopeRowId) ?? null;
  return {
    record,
    title: titleIn(entry, languageCode),
    where: resolveWhere(entry.target.where, scopeRow),
    pageKey: pageKeyOf(nodes, route.code),
    declared: nodes,
    rootKey: !page && trail.length > 1 ? trail[0].key : null,
    back: backOf(trail.at(-2), page ? route.scopeRowId : "", languageCode),
  };
};

export const useHomeRecord = (route: HomeRecordRoute) => {
  const { code: languageCode } = useLanguage();
  return useLoad(() => loadView(route, languageCode), `home-record:${openAgencyId()}:${route.listUrl}:${languageCode}`);
};
