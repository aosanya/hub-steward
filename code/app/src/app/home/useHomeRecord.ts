import { useLoad } from "../../features/forms/useLoad";
import { useLanguage } from "../../shared/language/language";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { loadDeclaredRecord, loadDeclaredRows, resolveWhere, type DeclaredRecord, type DeclaredRow, type PlainCondition } from "../menu/declaredRecord";
import { homeTab } from "../tabs";
import { findNode, loadDeclaredNodes, pageKeyOf, recordEntryIn, titleIn } from "./homeRecordNodes";
import type { HomeRecordRoute } from "./homeRecordRoute";

export type HomeRecordView = {
  record: DeclaredRecord | null;
  title: string;
  where: PlainCondition[] | null;
  pageKey: string | null;
  back: { to: string; label: string };
};

const loadView = async (route: HomeRecordRoute, languageCode: string): Promise<HomeRecordView> => {
  const [nodes, record, outerRows] = await Promise.all([
    loadDeclaredNodes().catch(() => []),
    loadDeclaredRecord(route.code),
    route.outer ? loadDeclaredRows(route.outer.code, []) : Promise.resolve([] as DeclaredRow[]),
  ]);
  const found = findNode(nodes, route.sectionKey);
  const section = found && found.targetType === "" ? found : null;
  const entry = recordEntryIn(nodes, route.sectionKey, route.code, route.entryKey);
  const outerRow = outerRows.find((row) => row.id === route.outer?.rowId) ?? null;
  const where = resolveWhere(entry?.where ?? [], outerRow);
  const title = entry ? titleIn(entry, languageCode) : (record?.name ?? "");
  const back = route.outer
    ? { to: route.outerPagePath, label: section ? titleIn(section, languageCode) : homeTab.label }
    : section
      ? { to: `${route.agencyBase}/home/${route.inKey}`, label: titleIn(section, languageCode) }
      : { to: `${route.agencyBase}/home`, label: homeTab.label };
  return { record, title, where, pageKey: pageKeyOf(nodes, route.code), back };
};

export const useHomeRecord = (route: HomeRecordRoute) => {
  const { code: languageCode } = useLanguage();
  return useLoad(() => loadView(route, languageCode), `home-record:${openAgencyId()}:${route.listPath}:${languageCode}`);
};
