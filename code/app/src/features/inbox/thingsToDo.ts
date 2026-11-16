import { unreadLabel } from "../chat/unread";

export const thingsToDoLabel = (count: number | null) => {
  const shown = unreadLabel(count);
  if (!shown) return null;
  return { shown, words: `${shown} ${count === 1 ? "thing" : "things"} to do` };
};
