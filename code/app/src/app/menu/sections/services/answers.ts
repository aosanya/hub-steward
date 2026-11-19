import { rangeWords } from "../../../../features/forms/timeRange";
import { text, type Item } from "../staff/staffData";

const valueKeys = ["value_text", "value_number", "value_date", "value_time"];

const yesWords = "Yes";

const noWords = "No";

export const valueKeyOf = (answer: Item) => valueKeys.find((key) => text(answer, key) !== "") ?? "";

export const answerWordsOf = (answer: Item) => {
  if (text(answer, "value_time_to") !== "") return rangeWords(text(answer, "value_time"), text(answer, "value_time_to"));
  const valueKey = valueKeyOf(answer);
  if (valueKey !== "") return text(answer, valueKey);
  if (typeof answer.value_bool !== "boolean") return "";
  return answer.value_bool ? yesWords : noWords;
};
