import { FactsCard } from "../../FactsCard";
import { MenuWindow } from "../../MenuWindow";
import { PageFrame } from "../../PageFrame";
import { SectionGo } from "../residents/SectionAct";
import { settingsPaths } from "./paths";
import { ChatAboutItem, useChosenItem } from "./RecordPage";
import { detailsOfRecord, onPage, recordCodeOf, recordOfCode, records, stateWords, summaryWords } from "./registerRecords";

const title = "Details of a record";

const editPermission = "permission.override";

const loadRecords = () =>
  Promise.all(
    records.map(async (record) => ({ id: await recordCodeOf(record), name: record.name, summary: summaryWords(await detailsOfRecord(record)) })),
  );

const loadRecord = async (id: string) => {
  const record = await recordOfCode(id);
  const details = record ? await detailsOfRecord(record) : [];
  return {
    id,
    name: record?.name ?? "",
    summary: summaryWords(details),
    facts: record ? details.map((detail) => [detail.prompt, stateWords(record, detail)]) : [],
    onPage: details.map(onPage).join("; "),
  };
};

export function RegisterDetails() {
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={useChosenItem()}
      list={{ title: "Records", tool: "register_details_records", load: loadRecords, fields: { title: "name", meta: "summary" }, empty: { words: "No records." } }}
      detail={{
        tool: "register_details_record",
        load: loadRecord,
        fields: {},
        status: "",
        extra: (record) => (
          <>
            <ChatAboutItem about={{ kind: "record-details", id: String(record.id), name: String(record.name), extra: { details: String(record.onPage) } }} back={settingsPaths.registerDetails.path()} />
            <PageFrame title={String(record.name)} line={String(record.summary)}>
              <FactsCard
                word="Details"
                facts={record.facts as [string, string][]}
                foot={<SectionGo permission={editPermission} act="Edit details" to={settingsPaths.registerDetailsEdit.path({ id: String(record.id) })} />}
              />
            </PageFrame>
          </>
        ),
      }}
    />
  );
}
