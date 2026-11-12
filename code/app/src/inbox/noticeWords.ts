import type { Words } from "../entry/words";
import { orderPath } from "../coordinator/payments/OrderCards";
import type { NotificationItem } from "./api";
import { chatMetaOf, chatTitleOf, threadPathOf } from "./chatNotice";
import { noticeMetaOf, noticePathOf, noticeTitleOf } from "./notice";

export const titleOf = (n: NotificationItem, words: Words) => noticeTitleOf(n, words) ?? chatTitleOf(n, words) ?? words.inboxNotification;

export const metaOf = (n: NotificationItem, words: Words) => noticeMetaOf(n, words) ?? chatMetaOf(n);

const calledOff = (n: NotificationItem) => n.event === "group_order_called_off" && n.subjectKind === "group_order" && n.subjectId !== "";

export const pathOf = (n: NotificationItem) => (calledOff(n) ? orderPath(n.subjectId) : (noticePathOf(n) ?? threadPathOf(n)));
