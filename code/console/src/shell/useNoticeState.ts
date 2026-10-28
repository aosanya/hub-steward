import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoticeApi, NoticeMessage } from "../ui/noticeContext";
import type { NoticeKind } from "../ui/props";

export const okNoticeLasts = 6000;

type Held = { hubId: string; message: NoticeMessage };

export function useNoticeState(hubId: string): NoticeApi {
  const [held, setHeld] = useState<Held | null>(null);
  const issued = useRef(0);

  const message = held && held.hubId === hubId ? held.message : null;

  const show = useCallback(
    (text: string, kind: NoticeKind = "ok") => {
      issued.current += 1;
      setHeld({ hubId, message: { id: issued.current, text, kind } });
    },
    [hubId],
  );

  const dismiss = useCallback(() => setHeld(null), []);

  useEffect(() => {
    if (!message || message.kind !== "ok") return;
    const timer = setTimeout(dismiss, okNoticeLasts);
    return () => clearTimeout(timer);
  }, [message, dismiss]);

  return useMemo(() => ({ message, show, dismiss }), [message, show, dismiss]);
}
