import { Button } from "../ui/Button";
import { Rows } from "../ui/ListRow";
import { SectionHeading } from "../ui/SectionHeading";
import type { NotificationItem } from "./api";
import { NoticeRow } from "./NoticeRow";

type Props = {
  notices: NotificationItem[];
  chosen: string[];
  onTick: (id: string, on: boolean) => void;
  onMarkRead: () => void;
  onOpenNotice: (notice: NotificationItem, path: string) => void;
};

export function UpdatesSection({ notices, chosen, onTick, onMarkRead, onOpenNotice }: Props) {
  const anythingUnread = notices.some((n) => !n.read);
  const markRead = anythingUnread ? <Button onClick={onMarkRead}>{chosen.length > 0 ? "Mark read" : "Mark all read"}</Button> : undefined;
  return (
    <>
      <SectionHeading action={markRead}>Updates</SectionHeading>
      <Rows>
        {notices.map((n) => (
          <NoticeRow key={n.id} notice={n} choice={{ checked: chosen.includes(n.id), onChange: (on) => onTick(n.id, on) }} onOpen={onOpenNotice} />
        ))}
      </Rows>
    </>
  );
}
