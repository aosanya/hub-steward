import { useEffect, useRef, useState } from "react";
import type { FilesClient, Folder, FolderEntry, Listing } from "./api";

export type Answer = Listing | { status: "failed" };

export type Listings = { answers: Record<string, Answer>; entries: Record<string, FolderEntry[]>; retry: (path: string) => void };

const entriesOf = (answers: Record<string, Answer>) =>
  Object.fromEntries(Object.entries(answers).flatMap(([path, answer]) => (answer.status === "listed" ? [[path, answer.entries]] : [])));

export function useListings(client: FilesClient, folder: Folder, wanted: string[]): Listings {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [attempt, setAttempt] = useState(0);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    wanted
      .filter((path) => !asked.current.has(path))
      .forEach((path) => {
        asked.current.add(path);
        client
          .list(folder, path)
          .catch((): Answer => ({ status: "failed" }))
          .then((answer) => setAnswers((was) => ({ ...was, [path]: answer })));
      });
  }, [wanted.join("\n"), attempt]);
  const retry = (path: string) => {
    asked.current.delete(path);
    setAnswers(({ [path]: _gone, ...rest }) => rest);
    setAttempt((was) => was + 1);
  };
  return { answers, entries: entriesOf(answers), retry };
}
