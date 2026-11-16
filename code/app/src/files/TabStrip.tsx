import { Icon } from "../shared/ui/Icon";
import { entryIcon } from "./entryIcon";
import type { Tab } from "./openTabs";

type Props = { tabs: Tab[]; active: string | null; onFocus: (path: string) => void; onClose: (path: string) => void };

export function TabStrip({ tabs, active, onFocus, onClose }: Props) {
  return (
    <div className="wf-strip" role="tablist" aria-label="Open tabs">
      {tabs.map((tab) => (
        <div key={tab.path} className={tab.path === active ? "wf-tab active" : "wf-tab"} role="presentation">
          <span className="wf-icon fi" aria-hidden="true">
            <Icon name={entryIcon({ ...tab, folder: false })} />
          </span>
          <button type="button" role="tab" className="wf-tab-name" aria-selected={tab.path === active} title={tab.path} onClick={() => onFocus(tab.path)}>
            {tab.name}
          </button>
          <button type="button" className="wf-tab-close" aria-label={`Close ${tab.name}`} onClick={() => onClose(tab.path)}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
