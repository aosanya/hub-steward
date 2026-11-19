import { useLanguage } from "../../shared/language/language";
import { Button } from "../../shared/ui/Button";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { Sheet } from "../../shared/ui/Sheet";
import type { NotificationItem } from "./api";
import { unpaidRowsOf } from "./unpaidList";

type Props = { notice: NotificationItem; onClose: () => void };

export function UnpaidListSheet({ notice, onClose }: Props) {
  const { words } = useLanguage();
  const total = notice.names.total ?? "";
  return (
    <Sheet title={words.inboxPaymentListSheet} onClose={onClose}>
      {total ? <p>{words.inboxPaymentListTotal.replace("{name}", () => total)}</p> : null}
      <Rows>
        {unpaidRowsOf(notice).map((row, index) => (
          <ListRow key={`${index}:${row.payer}`} title={row.payer} meta={row.detail || undefined} />
        ))}
      </Rows>
      <Button onClick={onClose}>{words.close}</Button>
    </Sheet>
  );
}
