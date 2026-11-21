import { agencyHomePath, openAgencyId } from "../../shared/wakala/openAgency";

const homeBase = () => agencyHomePath(openAgencyId());

const part = (value: string) => encodeURIComponent(value);

const scopeQuery = (scopeRowId: string | undefined) => (scopeRowId ? `?row=${part(scopeRowId)}` : "");

export const homeSectionPath = (key: string) => `${homeBase()}/${part(key)}`;

export const homeRecordPath = (entryKey: string, code: string, scopeRowId?: string) => `${homeBase()}/${part(entryKey)}/records/${part(code)}${scopeQuery(scopeRowId)}`;

export const homeRowPagePath = (key: string, rowId: string) => `${homeBase()}/${part(key)}/row/${part(rowId)}`;

export const homeWaitingPath = (entryKey: string, scopeRowId?: string) => `${homeBase()}/${part(entryKey)}/waiting${scopeQuery(scopeRowId)}`;

export const homePath = () => homeBase();
