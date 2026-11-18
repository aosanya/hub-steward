import { routes } from "../../../routes";
import type { RecordFormField } from "../../RecordRowForm";
import { RecordRowsScreen } from "../../RecordRowsScreen";
import { useRegisterFields } from "../../registerDetails";
import { RecordEditScreen } from "../../RecordEditScreen";
import { residentPaths } from "./paths";

export const informalTradersRecordCode = "RC-2";
export const informalTradersTitlePrompt = "Name or alias";
export const informalTradersMetaPrompts = ["Kind of trader", "What is sold", "Neighbourhood"];

export const informalTraderFields: RecordFormField[] = [
  { prompt: "Name or alias", required: true },
  { prompt: "Kind of trader", required: true, options: ["Stall holder at the market", "Street seller"] },
  { prompt: "What is sold", required: true },
  { prompt: "Usual place", required: false },
  { prompt: "Usual days", required: false },
  { prompt: "Neighbourhood", required: true, options: ["Óváros", "Kertváros", "Malomsor", "Határrét"] },
  { prompt: "Status", required: true, options: ["Active", "Suspended", "Closed"] },
  { prompt: "Holder", required: false, people: true },
];

export const useInformalTraderFields = () => useRegisterFields(informalTradersRecordCode, informalTraderFields);

export function InformalTradersScreen() {
  const fields = useInformalTraderFields();
  return (
    <RecordRowsScreen
      title="Informal traders"
      recordCode={informalTradersRecordCode}
      titlePrompt={informalTradersTitlePrompt}
      detailWord="Trader detail"
      prompts={fields.filter((field) => !field.people).map((field) => field.prompt)}
      metaPrompts={informalTradersMetaPrompts}
      owner={{ prompt: "Holder", heading: "Holder" }}
      editPath={(id) => residentPaths.informalTraderEdit.path({ id })}
      chat={{ kind: "trader", back: (id) => residentPaths.informalTraders.path({ row: id }) }}
      empty={{ words: "No informal traders yet.", act: "Add trader", to: routes.informalTraderNew.path() }}
    />
  );
}

export function InformalTraderEditScreen() {
  return <RecordEditScreen title="Edit trader" recordCode={informalTradersRecordCode} fields={useInformalTraderFields()} back={{ to: (id) => residentPaths.informalTraders.path({ row: id }), label: "Informal traders" }} />;
}
