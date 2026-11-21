import { useLocation, useSearchParams } from "react-router-dom";
import { agencyBasePath } from "../../shared/wakala/openAgency";

export type RecordMode = "list" | "new" | "edit";

export type HomeRecordRoute = {
  agencyBase: string;
  entryKey: string;
  code: string;
  scopeRowId: string;
  mode: RecordMode;
  editId: string;
  listPath: string;
  listUrl: string;
};

const shape = /^\/a\/([^/]+)\/home\/([^/]+)\/records\/([^/]+)(?:\/(new)|\/([^/]+)\/edit)?\/?$/;

export const scopeQueryOf = (scopeRowId: string) => (scopeRowId ? `row=${encodeURIComponent(scopeRowId)}` : "");

export const withQuery = (path: string, ...queries: string[]) => {
  const joined = queries.filter(Boolean).join("&");
  return joined ? `${path}?${joined}` : path;
};

export const homeRecordRouteOf = (pathname: string, search = ""): HomeRecordRoute | null => {
  const found = shape.exec(pathname);
  if (!found) return null;
  const [, agency, entryKey, code, isNew, editId] = found;
  const scopeRowId = new URLSearchParams(search).get("row") ?? "";
  const listPath = `/a/${agency}/home/${entryKey}/records/${code}`;
  return {
    agencyBase: agencyBasePath(decodeURIComponent(agency)),
    entryKey: decodeURIComponent(entryKey),
    code: decodeURIComponent(code),
    scopeRowId,
    mode: isNew ? "new" : editId ? "edit" : "list",
    editId: editId ? decodeURIComponent(editId) : "",
    listPath,
    listUrl: withQuery(listPath, scopeQueryOf(scopeRowId)),
  };
};

export const useHomeRecordRoute = () => {
  const { pathname } = useLocation();
  const [search] = useSearchParams();
  return homeRecordRouteOf(pathname, `?${search.toString()}`);
};
