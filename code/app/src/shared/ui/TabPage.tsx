import { EmptyCard } from "./LoadState";
import { Shell } from "./Shell";
import type { Tab } from "../../app/tabs";

export function TabPage({ tab }: { tab: Tab }) {
  return (
    <Shell title={tab.label}>
      <EmptyCard words={tab.label} />
    </Shell>
  );
}
