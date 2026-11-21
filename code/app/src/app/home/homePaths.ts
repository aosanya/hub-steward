import { agencyHomePath, openAgencyId } from "../../shared/wakala/openAgency";

const homeBase = () => agencyHomePath(openAgencyId());

const part = (value: string) => encodeURIComponent(value);

export const homeSectionPath = (key: string) => `${homeBase()}/${part(key)}`;

export const homeRecordPath = (inKey: string, code: string) => `${homeBase()}/${part(inKey)}/records/${part(code)}`;

export const homeRowPagePath = (inKey: string, code: string, rowId: string, pageKey: string) => `${homeRecordPath(inKey, code)}/${part(rowId)}/${part(pageKey)}`;

export const homeRowRecordPath = (inKey: string, code: string, rowId: string, pageKey: string, innerCode: string) => `${homeRowPagePath(inKey, code, rowId, pageKey)}/records/${part(innerCode)}`;

export const homePath = () => homeBase();
