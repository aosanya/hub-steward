import { kes } from "../../market/shared/money";
import { GROUP_COORDINATOR, listPeople, namesOf, type Person } from "../../../features/people/api";
import { addLiveRecordRowTool, liveRecordRowsTool, liveRecordsTool } from "../../../shared/wakala/liveRecords";
import { callTool } from "../../../shared/wakala/mcp";

export type Question = { key: string; prompt: string; answerType: string; listName: string };
export type PaymentsRecord = { key: string; name: string; canAdd: boolean; farmerKey: string; farmerPrompt: string; amountKey: string; amountPrompt: string };
export type Payment = { id: string; farmer: string; farmerId: string; amount: string; paid: string; correctedOn: string };
export type Saving = "saved" | "duplicate" | "failed";
export type NewPayment = { record: PaymentsRecord; orderId: string; farmerId: string; amount: string; replaces?: string };

export type PaymentsClient = {
  record: () => Promise<PaymentsRecord | null>;
  payments: (record: PaymentsRecord, orderId: string) => Promise<Payment[]>;
  people: () => Promise<Person[]>;
  add: (payment: NewPayment) => Promise<Saving>;
  owns: () => Promise<boolean>;
  runs: () => Promise<boolean>;
  send: (orderId: string) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const listOf = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : listOf(reply?.items));

export const recordOf = (raw: any): PaymentsRecord | null => {
  const questions: Question[] = listOf(raw?.questions).map((q) => ({
    key: text(q?.key),
    prompt: text(q?.prompt),
    answerType: text(q?.answer_type),
    listName: text(q?.options_from),
  }));
  const farmer = questions.find((q) => q.answerType === "single_choice" && q.listName !== "");
  const amount = questions.find((q) => q !== farmer);
  if (!farmer || !amount || text(raw?.key) === "" || farmer.key === "" || amount.key === "") return null;
  return { key: text(raw.key), name: text(raw?.name), canAdd: raw?.can_add_rows === true, farmerKey: farmer.key, farmerPrompt: farmer.prompt, amountKey: amount.key, amountPrompt: amount.prompt };
};

export const paymentOf = (record: PaymentsRecord, names: Map<string, string>) => (raw: any): Payment => {
  const id = text(raw?.answers?.[record.farmerKey]);
  return {
    id: text(raw?.id),
    farmer: names.get(id) ?? record.farmerPrompt,
    farmerId: id,
    amount: kes(text(raw?.answers?.[record.amountKey])),
    paid: text(raw?.answers?.[record.amountKey]),
    correctedOn: text(raw?.corrected_on).slice(0, 10),
  };
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const ownsOf = (reply: any) => reply?.membership === "owner";

export const holdsGroupCoordinator = (reply: any) => listOf(reply?.roles).some((role) => sameName(text(role?.name), GROUP_COORDINATOR));

export const isDuplicate = (error: unknown) => error instanceof Error && error.message.includes("saved a moment ago");

export const mcpPaymentsClient: PaymentsClient = {
  async record() {
    for (const raw of itemsOf(await callTool("", liveRecordsTool))) {
      const found = recordOf(raw);
      if (found) return found;
    }
    return null;
  },
  async payments(record, orderId) {
    const rows = itemsOf(await callTool("", liveRecordRowsTool, { record_code: record.key, order_id: orderId }));
    return rows.map(paymentOf(record, namesOf(await listPeople())));
  },
  people: listPeople,
  async add({ record, orderId, farmerId, amount, replaces }) {
    try {
      await callTool("", addLiveRecordRowTool, {
        record_code: record.key,
        order_id: orderId,
        answers: { [record.farmerKey]: farmerId, [record.amountKey]: amount },
        ...(replaces ? { replaces } : {}),
      });
      return "saved";
    } catch (error) {
      return isDuplicate(error) ? "duplicate" : "failed";
    }
  },
  async owns() {
    return ownsOf(await callTool("", "agency_get_my_roles"));
  },
  async runs() {
    const reply = await callTool("", "agency_get_my_roles");
    return ownsOf(reply) || holdsGroupCoordinator(reply);
  },
  async send(orderId) {
    await callTool("", "market_send_group_order", { groupOrderID: orderId });
  },
};
