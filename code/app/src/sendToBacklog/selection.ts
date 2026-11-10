import { useState } from "react";

export function useSelection() {
  const [on, setOn] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const toggle = (id: string, checked: boolean) => setIds((now) => (checked ? (now.includes(id) ? now : [...now, id]) : now.filter((one) => one !== id)));
  return {
    on,
    ids,
    count: ids.length,
    has: (id: string) => ids.includes(id),
    start: () => setOn(true),
    cancel: () => {
      setOn(false);
      setIds([]);
    },
    toggle,
    selectAll: (shown: string[]) => setIds(shown),
  };
}

export type Selecting = ReturnType<typeof useSelection>;
