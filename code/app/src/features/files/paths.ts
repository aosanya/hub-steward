import { agencyBasePath, openAgencyId } from "../../shared/wakala/openAgency";

export const filesSegment = "files";

export const pathParam = "path";

const filesBase = () => `${agencyBasePath(openAgencyId())}/${filesSegment}`;

const withPath = (route: string, path: string) => (path === "" ? route : `${route}?${new URLSearchParams({ [pathParam]: path }).toString()}`);

export const filesHomePath = () => filesBase();

export const folderPath = (id: string, path = "") => withPath(`${filesBase()}/${encodeURIComponent(id)}`, path);

export const filePath = (id: string, path: string) => withPath(`${filesBase()}/${encodeURIComponent(id)}/file`, path);
