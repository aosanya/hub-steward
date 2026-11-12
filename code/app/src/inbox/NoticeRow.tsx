import { useLanguage } from "../entry/language";
import { isoDay } from "../ui/days";
import { ListRow, SelectableRow } from "../ui/ListRow";
import type { NotificationItem } from "./api";
import { metaOf, pathOf, titleOf } from "./noticeWords";

export type Choice = { checked: boolean; onChange: (checked: boolean) => void };

type Props = { notice: NotificationItem; choice?: Choice; onOpen: (notice: NotificationItem, path: string) => void };

export function NoticeRow({ notice, choice, onOpen }: Props) {
  const { words } = useLanguage();
  const path = pathOf(notice);
  const title = titleOf(notice, words);
  const row = {
    title,
    meta: metaOf(notice, words),
    start: notice.read || !path ? <span className="dot off" aria-hidden="true" /> : <span className="dot" role="img" aria-label="Unread" />,
    end: isoDay(notice.createdAt),
    onClick: path ? () => onOpen(notice, path) : undefined,
  };
  return choice === undefined ? <ListRow {...row} /> : <SelectableRow selection={notice.read ? null : { ...choice, label: `Select ${title}` }} {...row} />;
}
