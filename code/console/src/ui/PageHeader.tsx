import { useEnhanceAction } from "../shell/useEnhanceAction";
import { ActionsMenu } from "./ActionsMenu";
import { Chip } from "./Chip";
import { NoticeBar } from "./Notice";
import { Toggle } from "./Toggle";
import type { HeaderMeta, PageHeaderProps } from "./props";

function Meta({ item }: { item: HeaderMeta }) {
  return item.tone ? <Chip kind={item.tone}>{item.text}</Chip> : <span className="muted">{item.text}</span>;
}

export function PageHeader({ title, meta = [], switches = [], actions = [] }: PageHeaderProps) {
  const enhance = useEnhanceAction();
  const all = enhance ? [enhance, ...actions] : actions;
  const hasEnd = switches.length > 0 || all.length > 0;
  return (
    <>
      <div className="top">
        <h1>{title}</h1>
        {meta.length > 0 ? (
          <div className="top-meta">
            {meta.map((item) => (
              <Meta key={item.text} item={item} />
            ))}
          </div>
        ) : null}
        {hasEnd ? (
          <div className="top-end">
            {switches.map((item) => (
              <Toggle key={item.label} label={item.label} on={item.on} onChange={item.onChange} disabled={item.disabled} />
            ))}
            {all.length > 0 ? <ActionsMenu actions={all} /> : null}
          </div>
        ) : null}
      </div>
      <NoticeBar />
    </>
  );
}
