import { unreadLabel } from "../chat/unread";

type Wording = (generic: string) => string;

const asWritten: Wording = (generic) => generic;

export const thingsToDoLabel = (count: number | null, word: Wording = asWritten) => {
  const shown = unreadLabel(count);
  if (!shown) return null;
  const noun = word(count === 1 ? "Thing" : "Things").toLowerCase();
  return { shown, words: `${shown} ${noun} to do` };
};
