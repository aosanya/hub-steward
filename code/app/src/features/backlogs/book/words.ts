import { useLanguage } from "../../../shared/language/language";
import type { Words } from "../../../shared/language/words";
import { longDayWords } from "../../../shared/ui/days";

export const bookWords = (t: Words) => ({
  bookButton: t.bkButton,
  readAsBookButton: t.bkReadAs,
  readAsBookHint: t.bkReadAsHint,
  bookTitle: t.bkTitle,
  readOnWords: (date: Date) => t.bkReadOn.replace("{date}", longDayWords(date)),
  contentsLabel: t.bkContents,
  cameFromWords: t.bkCameFrom,
  doneRightInWords: t.bkDoneRightIn,
  emptyWords: t.bkEmpty,
  loadFailedWords: t.bkLoadFailed,
  and: t.bkAnd,
});

export type BookWords = ReturnType<typeof bookWords>;

export const useBookWords = (): BookWords => bookWords(useLanguage().words);

export const joinWords = <T,>(items: T[], and: string): (T | string)[] =>
  items.flatMap((item, at) => (at === 0 ? [item] : [at === items.length - 1 ? ` ${and} ` : ", ", item]));
