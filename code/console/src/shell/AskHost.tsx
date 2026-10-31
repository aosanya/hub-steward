import type { MutableRefObject } from "react";
import type { Ask } from "./chatTell";
import { ChatColumn } from "./ChatColumn";
import { useAskQueue } from "./useAskQueue";

type AskHostProps = { asks: MutableRefObject<Ask | null>; hubId: string; page?: string };

export function AskHost({ asks, hubId, page = "status" }: AskHostProps) {
  const queued = useAskQueue(hubId);
  asks.current = queued.ask;
  return (
    <ChatColumn
      hubId={hubId}
      page={page}
      rail={false}
      onToggleRail={() => {}}
      queue={queued.queue}
      onTake={queued.take}
      onCancelQueued={queued.cancel}
      onCancelAll={queued.cancelAll}
    />
  );
}
