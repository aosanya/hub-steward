import { accountListTool } from "./markBillPaid";
import { certificateWords, listOf, milestoneWords, text, tools, type Item } from "./financeData";

export const noStages = { milestones: "", certificates: "" };

const payeeNames = async () => new Map((await listOf(accountListTool)).map((account) => [text(account, "id"), text(account, "name") || text(account, "code")]));

const loadStages = async (accountId: string, unit: string) => {
  const milestones = await listOf(tools.milestoneList, { accountID: accountId });
  const certificateLists = await Promise.all(milestones.map((milestone) => listOf(tools.certificateList, { milestoneID: text(milestone, "id") })));
  const certified = milestones.flatMap((milestone, index) => certificateLists[index].map((certificate) => ({ certificate, milestone })));
  const payees = certified.length > 0 ? await payeeNames() : new Map<string, string>();
  return {
    milestones: milestones.map((milestone: Item) => milestoneWords(milestone, unit)).join(", "),
    certificates: certified.map(({ certificate, milestone }) => certificateWords(certificate, text(milestone, "name"), payees.get(text(certificate, "payee_account_id")) ?? "", unit)).join(", "),
  };
};

export const lineStages = async (accountId: string, unit: string) => {
  if (accountId === "") return noStages;
  try {
    return await loadStages(accountId, unit);
  } catch {
    return noStages;
  }
};
