import { EmptyCard } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import type { Tab } from "../tabs";

export function TabPage({ tab }: { tab: Tab }) {
  return (
    <Shell title={tab.label}>
      <EmptyCard words={tab.label} />
    </Shell>
  );
}
