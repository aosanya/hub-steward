import { PaidMark } from "./PaidMark";
import { homeEmpty, listOf, orderRow, text, type Item } from "./orders";
import { FinanceList } from "./FinanceList";

const title = "Revenue & Billing";

const formsOf = (orders: Item[]) => [...new Set(orders.map((order) => text(order, "form_id")).filter((id) => id !== ""))];

const sentBy = async (formId: string) => {
  const sent = await listOf("forms_submission_list", { form_id: formId });
  return sent.map((submission) => `${formId}:${text(submission, "member_id")}`);
};

const loadBilling = async () => {
  const orders = await listOf("market_list_orders");
  const paidForm = new Set((await Promise.all(formsOf(orders).map(sentBy))).flat());
  return orders.map((order) => orderRow(order, order.paid === true || paidForm.has(`${text(order, "form_id")}:${text(order, "picker")}`)));
};

export function RevenueBillingScreen() {
  return (
    <FinanceList
      title={title}
      tool="market_list_orders"
      load={loadBilling}
      fields={{ title: "payer", meta: "line" }}
      empty={homeEmpty("No orders yet.")}
      end={(order) => (order.paid === true ? <PaidMark /> : null)}
    />
  );
}
