import { Button } from "../../shared/ui/Button";
import { Rows } from "../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { SectionHeading } from "../../shared/ui/SectionHeading";
import type { NotificationItem } from "./api";
import { NoticeRow } from "./NoticeRow";
import type { SectionState } from "./sectionState";

type Props = {
  notices: NotificationItem[];
  state: SectionState;
  onRetry: () => void;
  chosen: string[];
  onTick: (id: string, on: boolean) => void;
  onMarkRead: () => void;
  onOpenNotice: (notice: NotificationItem, path: string) => void;
};

export function UpdatesSection({ notices, state, onRetry, chosen, onTick, onMarkRead, onOpenNotice }: Props) {
  const anythingUnread = notices.some((n) => !n.read);
  const markRead = anythingUnread ? <Button onClick={onMarkRead}>{chosen.length > 0 ? "Mark read" : "Mark all read"}</Button> : undefined;
  return (
    <>
      <SectionHeading action={markRead}>Updates</SectionHeading>
      {state.loading ? <LoadingLine words="Loading Updates" /> : null}
      {state.words ? <LoadFailed words={state.words} onRetry={onRetry} /> : null}
      {notices.length > 0 ? (
        <Rows>
          {notices.map((n) => (
            <NoticeRow key={n.id} notice={n} choice={{ checked: chosen.includes(n.id), onChange: (on) => onTick(n.id, on) }} onOpen={onOpenNotice} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
