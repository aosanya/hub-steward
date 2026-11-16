import { FinanceList } from "./FinanceList";
import { homeEmpty, listOf, text } from "./orders";

const waitingWords = "Waiting for quote";

const quotedWords = "Quoted";

const loadRequests = async () => {
  const asks = await listOf("market_list_asks");
  return Promise.all(
    asks.map(async (ask) => {
      const quotes = await listOf("market_list_quotes", { noticeID: text(ask, "request_id") });
      return { id: text(ask, "id"), item: text(ask, "question"), status: quotes.length > 0 ? quotedWords : waitingWords };
    }),
  );
};

export function ProcurementScreen() {
  return (
    <FinanceList
      title="Procurement"
      tool="market_list_asks"
      load={loadRequests}
      fields={{ title: "item", meta: "status" }}
      empty={homeEmpty("No requests yet.")}
    />
  );
}
