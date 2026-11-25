import { longDayWords } from "../../../shared/ui/days";

export const bookButton = "Book";

export const bookTitle = "Best practices";

export const readOnWords = (date: Date) => `Read on ${longDayWords(date)}`;

export const contentsLabel = "Contents";

export const cameFromWords = "Came from";

export const doneRightInWords = "Done right in";

export const emptyWords = "No rules are in force yet.";

export const loadFailedWords = "The Book could not be loaded.";

export const joinWords = <T,>(items: T[]): (T | string)[] =>
  items.flatMap((item, at) => (at === 0 ? [item] : [at === items.length - 1 ? " and " : ", ", item]));
