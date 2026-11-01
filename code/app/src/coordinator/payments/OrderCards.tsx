import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../ui/Card";
import { ListRow, Rows } from "../../ui/ListRow";
import { isLive, mcpGroupOrderClient, termsWords, type GroupOrder, type GroupOrderClient } from "../../supply/groupOrder/api";
import { mcpPaymentsClient, type PaymentsClient } from "./api";

export const orderPath = (id: string) => `/coordinator/orders/${id}`;

type Props = { orders?: GroupOrderClient; payments?: PaymentsClient };

export function CoordinatorOrderCards({ orders = mcpGroupOrderClient, payments = mcpPaymentsClient }: Props) {
  const navigate = useNavigate();
  const [found, setFound] = useState<GroupOrder[]>([]);
  useEffect(() => {
    let live = true;
    payments
      .owns()
      .then((owner) => (owner ? orders.listGroupOrders() : []))
      .then(
        (list) => live && setFound(list.filter(isLive)),
        () => {},
      );
    return () => {
      live = false;
    };
  }, [orders, payments]);
  if (found.length === 0) return null;
  return (
    <Card>
      <Rows>
        {found.map((o) => (
          <ListRow key={o.id} lead title={o.productWords} meta={termsWords({ price: o.price, minimum: o.minimum })} end="›" onClick={() => navigate(orderPath(o.id))} />
        ))}
      </Rows>
    </Card>
  );
}
