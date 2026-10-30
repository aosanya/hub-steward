import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { ListRow, Rows } from "../../ui/ListRow";
import { Roster } from "../../ui/roster/Roster";
import { loadFromList } from "../../ui/roster/usePagedRoster";
import { SearchSelect } from "../../ui/SearchSelect";
import { SectionHeading } from "../../ui/SectionHeading";
import { Shell } from "../../ui/Shell";
import { bags, farmersWords, mcpGroupOrderClient, termsWords, type GroupOrder, type GroupOrderClient } from "../../supply/groupOrder/api";
import { mcpPaymentsClient, type Payment, type PaymentsClient, type PaymentsRecord } from "./api";

type Clients = { orders?: GroupOrderClient; payments?: PaymentsClient };

const PAGE = 3;

const orderFormName = "Create group order";

const sendable = (order: GroupOrder) => order.state === "open";

const standing = (order: GroupOrder) => {
  if (order.state === "sent") return <Chip tone="success">Sent</Chip>;
  if (order.state === "cancelled") return <Chip tone="danger">Called off</Chip>;
  return null;
};

const addedCount = async (payments: PaymentsClient, orderId: string) => {
  try {
    const record = await payments.record();
    return record ? (await payments.payments(record, orderId)).length : null;
  } catch {
    return null;
  }
};

const ordersPath = (orderId: string) => `/coordinator/orders/${orderId}`;

export function CoordinatorOrderPage({ orders = mcpGroupOrderClient, payments = mcpPaymentsClient }: Clients) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const [version, setVersion] = useState(0);
  const [problem, setProblem] = useState(false);
  const order = useLoad(async () => {
    const [found, runs, added] = await Promise.all([orders.getGroupOrder(orderId), payments.runs().catch(() => false), addedCount(payments, orderId)]);
    return { order: found, runs, added };
  }, `co${orderId}${version}`);
  const send = async () => {
    setProblem(false);
    try {
      await payments.send(orderId);
      setVersion(version + 1);
    } catch {
      setProblem(true);
    }
  };
  return (
    <Shell title={order.state === "ready" ? order.data.order.productWords : "Group order"} sub={order.state === "ready" ? orderFormName : undefined} onBack={() => navigate("/")}>
      {order.state === "error" ? <LoadFailed words="This group order could not be opened." /> : null}
      {order.state === "ready" ? (
        <>
          <Rows>
            <ListRow title={termsWords({ price: order.data.order.price, minimum: order.data.order.minimum })} end={standing(order.data.order)} />
            <ListRow title={`${bags(order.data.order.total)} of ${order.data.order.minimum}`} meta={[farmersWords(order.data.order.count), order.data.order.coordinator]} />
          </Rows>
          <SectionHeading>Records</SectionHeading>
          <Rows>
            <ListRow
              title="Manage payments"
              meta={order.data.added === null ? undefined : `${order.data.added} added`}
              end="›"
              onClick={() => navigate(`/coordinator/orders/${orderId}/payments`)}
            />
          </Rows>
          {order.data.runs && sendable(order.data.order) ? (
            <Button kind="primary" onClick={send}>
              Send the order
            </Button>
          ) : null}
          {problem ? <p className="ferr">The order was not sent. Try again.</p> : null}
        </>
      ) : null}
    </Shell>
  );
}

export function ManagePaymentsPage({ orders = mcpGroupOrderClient, payments = mcpPaymentsClient }: Clients) {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const data = useLoad(async () => {
    const [order, record] = await Promise.all([orders.getGroupOrder(orderId), payments.record()]);
    return { order, record, rows: record ? await payments.payments(record, orderId) : [] };
  }, `mp${orderId}`);
  const back = () => navigate(ordersPath(orderId));
  const add = () => navigate(`${ordersPath(orderId)}/payments/new`);
  const canAdd = data.state === "ready" && data.data.record?.canAdd === true;
  const paymentRow = (p: Payment) => ({
    key: p.id,
    title: p.farmer,
    meta: p.correctedOn ? `Corrected on ${p.correctedOn}` : undefined,
    end: p.amount,
    onClick: canAdd ? () => navigate(`${ordersPath(orderId)}/payments/${p.id}/correct`) : undefined,
  });
  return (
    <Shell title="Manage payments" onBack={back}>
      {data.state === "error" ? <LoadFailed words="The payments could not be loaded." /> : null}
      {data.state === "ready" && data.data.rows.length === 0 ? (
        <EmptyCard words="No payments yet">
          {data.data.record?.canAdd ? (
            <>
              <p>Add a farmer's payment when it reaches you.</p>
              <Button kind="primary" onClick={add}>
                Add a payment
              </Button>
            </>
          ) : null}
        </EmptyCard>
      ) : null}
      {data.state === "ready" && data.data.rows.length > 0 ? (
        <>
          <SectionHeading>{data.data.order.productWords}</SectionHeading>
          <Roster load={loadFromList(data.data.rows, (p) => p.id)} toRow={paymentRow} pageSize={PAGE} />
          {data.data.record?.canAdd ? (
            <Button kind="primary" onClick={add}>
              Add a payment
            </Button>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}

export function AddPaymentPage({ payments = mcpPaymentsClient }: Clients) {
  const navigate = useNavigate();
  const { orderId = "", rowId = "" } = useParams();
  const back = () => navigate(`${ordersPath(orderId)}/payments`);
  const data = useLoad(async () => {
    const record = await payments.record();
    const people = await payments.people();
    const earlier = rowId && record ? (await payments.payments(record, orderId)).find((p) => p.id === rowId) : undefined;
    return { record, people, earlier };
  }, `ap${orderId}${rowId}`);
  return (
    <Shell title={rowId ? "Correct a payment" : "Add a payment"} onBack={back}>
      {data.state === "error" || (data.state === "ready" && (!data.data.record || (rowId !== "" && !data.data.earlier))) ? <LoadFailed words="Payments could not be opened." /> : null}
      {data.state === "ready" && data.data.record && (rowId === "" || data.data.earlier) ? (
        <PaymentForm client={payments} orderId={orderId} record={data.data.record} people={data.data.people} earlier={data.data.earlier} done={back} />
      ) : null}
    </Shell>
  );
}

type FormProps = {
  client: PaymentsClient;
  orderId: string;
  record: PaymentsRecord;
  people: { id: string; name: string }[];
  earlier?: Payment;
  done: () => void;
};

const NOT_SAVED = "The payment was not saved. Try again.";
const JUST_SAVED = "This payment was just saved. Wait a minute to save it again.";

function PaymentForm({ client, orderId, record, people, earlier, done }: FormProps) {
  const [farmer, setFarmer] = useState(earlier?.farmerId ?? "");
  const [amount, setAmount] = useState(earlier?.paid ?? "");
  const [problem, setProblem] = useState("");
  const save = async () => {
    if (!farmer) return setProblem(`Choose ${record.farmerPrompt}.`);
    if (!amount.trim()) return setProblem(`Fill in ${record.amountPrompt}.`);
    setProblem("");
    const outcome = await client.add({ record, orderId, farmerId: farmer, amount: amount.trim(), replaces: earlier?.id }).catch(() => "failed" as const);
    if (outcome === "saved") return done();
    setProblem(outcome === "duplicate" ? JUST_SAVED : NOT_SAVED);
  };
  return (
    <Card>
      <SearchSelect label={record.farmerPrompt} value={farmer} onChange={setFarmer} choices={people.map((p) => ({ value: p.id, label: p.name }))} />
      <Field label={record.amountPrompt} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      {problem ? <p className="ferr">{problem}</p> : null}
      <Button kind="primary" onClick={save}>
        Save payment
      </Button>
    </Card>
  );
}
