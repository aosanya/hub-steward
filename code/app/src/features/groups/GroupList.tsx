import { useLanguage } from "../../shared/language/language";
import { Chip } from "../../shared/ui/Chip";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import type { SeatedGroup } from "./assumedApi";

type Props = { groups: SeatedGroup[]; currentId?: string; onPick: (group: SeatedGroup) => void };

export function GroupList({ groups, currentId, onPick }: Props) {
  const { words } = useLanguage();
  return (
    <Rows>
      {groups.map((group) => {
        const current = group.id === currentId;
        return (
          <ListRow
            key={group.id}
            title={group.name}
            lead
            meta={group.roles.length > 0 ? group.roles.join(" · ") : undefined}
            pressed={current ? true : undefined}
            end={current ? <Chip tone="accent">{words.groupCurrent}</Chip> : "›"}
            onClick={() => onPick(group)}
          />
        );
      })}
    </Rows>
  );
}
