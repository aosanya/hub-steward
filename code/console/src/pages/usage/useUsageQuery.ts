import { useSearchParams } from "react-router-dom";
import { defaultGroup, defaultSpan, spans, type UsageGroup, type UsageSpan } from "../../data/usageBreakdown";

type Patch = { span?: UsageSpan; group?: UsageGroup; role?: string };

export type UsageQuery = {
  span: UsageSpan;
  group: UsageGroup;
  role: string;
  change: (patch: Patch) => void;
};

const setOrDrop = (params: URLSearchParams, key: string, value: string, fallback: string) => {
  if (value === fallback) params.delete(key);
  else params.set(key, value);
};

export function useUsageQuery(): UsageQuery {
  const [params, setParams] = useSearchParams();
  const asked = params.get("span");
  const span = spans.find((candidate) => candidate === asked) ?? defaultSpan;
  const group: UsageGroup = params.get("group") === "person" ? "person" : defaultGroup;
  const role = params.get("role") ?? "";

  const change = (patch: Patch) =>
    setParams(
      (before) => {
        const next = new URLSearchParams(before);
        if (patch.span !== undefined) setOrDrop(next, "span", patch.span, defaultSpan);
        if (patch.group !== undefined) setOrDrop(next, "group", patch.group, defaultGroup);
        if (patch.role !== undefined) setOrDrop(next, "role", patch.role, "");
        return next;
      },
      { replace: true },
    );

  return { span, group, role, change };
}
