import { useLocation, useSearchParams } from "react-router-dom";
import { agencyBasePath } from "../../shared/wakala/openAgency";

export type RecordMode = "list" | "new" | "edit";

export type HomeRecordRoute = {
  agencyBase: string;
  inKey: string;
  code: string;
  outer: { code: string; rowId: string; pageKey: string } | null;
  mode: RecordMode;
  editId: string;
  listPath: string;
  outerPagePath: string;
  sectionKey: string;
  entryKey: string | null;
};

const shape = /^\/a\/([^/]+)\/home\/([^/]+)\/records\/([^/]+)(?:\/([^/]+)\/([^/]+)\/records\/([^/]+))?(?:\/(new)|\/([^/]+)\/edit)?\/?$/;

export const homeRecordRouteOf = (pathname: string, search = ""): HomeRecordRoute | null => {
  const found = shape.exec(pathname);
  if (!found) return null;
  const [, agency, inKey, first, rowId, pageKey, inner, isNew, editId] = found;
  const outer = inner ? { code: first, rowId, pageKey } : null;
  const code = inner ?? first;
  const base = `/a/${agency}/home/${inKey}/records/${first}`;
  const listPath = outer ? `${base}/${rowId}/${pageKey}/records/${code}` : base;
  return {
    agencyBase: agencyBasePath(decodeURIComponent(agency)),
    inKey,
    code,
    outer,
    mode: isNew ? "new" : editId ? "edit" : "list",
    editId: editId ?? "",
    listPath,
    outerPagePath: outer ? `${base}/${rowId}/${pageKey}` : "",
    sectionKey: outer ? pageKey : inKey,
    entryKey: new URLSearchParams(search).get("entry"),
  };
};

export const useHomeRecordRoute = () => {
  const { pathname } = useLocation();
  const [search] = useSearchParams();
  return homeRecordRouteOf(pathname, `?${search.toString()}`);
};
