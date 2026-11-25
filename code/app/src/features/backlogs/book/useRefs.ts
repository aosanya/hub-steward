import { useEffect, useState } from "react";
import { runLimited } from "../../../shared/wakala/runLimited";
import type { BookClient, Refs } from "./bookClient";

const readsAtOnce = 4;

export function useRefs(client: BookClient, codes: string[]): Record<string, Refs> {
  const [found, setFound] = useState<Record<string, Refs>>({});
  const key = codes.join("\n");
  useEffect(() => {
    setFound({});
    const control = new AbortController();
    runLimited(
      codes,
      readsAtOnce,
      async (code) => {
        const refs = await client.refs(code);
        if (!control.signal.aborted) setFound((now) => ({ ...now, [code]: refs }));
      },
      control.signal,
    );
    return () => control.abort();
  }, [client, key]);
  return found;
}
