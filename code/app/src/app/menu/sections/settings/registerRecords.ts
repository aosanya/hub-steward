import { resolveRecordKey } from "../../liveRecordRows";
import {
  detailsOf,
  holdingFields,
  holdingRecordCode,
  holdingTitlePrompt,
  readRegisterDetails,
  residentFields,
  residentRecordCode,
  residentTitlePrompt,
  type RegisterDetail,
} from "../../registerDetails";
import { businessesRecordCode, businessesTitlePrompt, businessFields } from "../residents/BusinessesScreen";
import { informalTraderFields, informalTradersRecordCode, informalTradersTitlePrompt } from "../residents/InformalTradersScreen";

export const records = [
  { name: "Businesses", code: businessesRecordCode, fields: businessFields, titlePrompt: businessesTitlePrompt },
  { name: "Informal traders", code: informalTradersRecordCode, fields: informalTraderFields, titlePrompt: informalTradersTitlePrompt },
  { name: "Residents", code: residentRecordCode, fields: residentFields, titlePrompt: residentTitlePrompt },
  { name: "Holdings", code: holdingRecordCode, fields: holdingFields, titlePrompt: holdingTitlePrompt },
];

export type RegisterRecord = (typeof records)[number];

export const recordKeyOf = (record: RegisterRecord) => resolveRecordKey(record.code);

export const recordOfKey = async (key: string): Promise<RegisterRecord | undefined> => {
  const keys = await Promise.all(records.map(recordKeyOf));
  return records[keys.indexOf(key)];
};

export const detailsOfRecord = async (record: RegisterRecord): Promise<RegisterDetail[]> => detailsOf(record.fields, await readRegisterDetails(record.code));

export const isFixed = (record: RegisterRecord, detail: RegisterDetail) => !detail.own && detail.prompt === record.titlePrompt;

export const stateWords = (record: RegisterRecord, detail: RegisterDetail) => {
  if (isFixed(record, detail)) return "Always on and required";
  if (!detail.on) return "Off";
  return detail.required ? "On, required" : "On";
};

export const summaryWords = (details: RegisterDetail[]) => `${details.filter((detail) => detail.on).length} of ${details.length} details on`;

export const onPage = (detail: RegisterDetail) => `${detail.prompt} (${detail.on ? (detail.required ? "on, required" : "on") : "off"})`;
