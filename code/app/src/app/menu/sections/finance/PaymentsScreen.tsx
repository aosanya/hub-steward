import { FinanceList } from "./FinanceList";
import { MarkPaidButton } from "./MarkPaidButton";
import { PaidMark } from "./PaidMark";
import { homeEmpty, listOf, orderRow, text } from "./orders";

const loadPayments = async () => (await listOf("market_list_orders")).map((order) => orderRow(order, order.paid === true));

export function PaymentsScreen() {
  return (
    <FinanceList
      title="Payments"
      tool="market_list_orders"
      load={loadPayments}
      fields={{ title: "payer", meta: "line" }}
      empty={homeEmpty("No payments yet.")}
      end={(order) => (order.paid === true ? <PaidMark /> : <MarkPaidButton orderId={text(order, "id")} />)}
    />
  );
}
