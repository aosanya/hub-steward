import { useContext, useState } from "react";
import { rolesOf, type MyGroup } from "../data/groups";
import { ErrorLine } from "../entry/ErrorLine";
import { useI18n } from "../i18n";
import { Badge, Chip, initials } from "../ui";
import { Icon } from "../ui/Icon";
import { GroupCtx } from "./groupContext";
import { useDrop } from "./useDrop";

function GroupName({ group }: { group: MyGroup }) {
  const { t } = useI18n();
  return (
    <span className="hub-text">
      <span className="hub-name">{group.name}</span>
      <span className="hub-meta">
        <Chip kind="mute">{t("groupTag")}</Chip>
      </span>
    </span>
  );
}

export function GroupSwitcher() {
  const { t } = useI18n();
  const control = useContext(GroupCtx);
  const { open, setOpen, root, toggle } = useDrop();
  const [refused, setRefused] = useState(false);
  if (!control) return null;
  const { groups, assumed, assume } = control;

  if (groups.length < 2)
    return (
      <div className="switch">
        <span className="hub compact only">
          <GroupName group={assumed} />
        </span>
      </div>
    );

  const ordered = [assumed, ...groups.filter((group) => group.id !== assumed.id)];

  const pick = async (group: MyGroup) => {
    if (group.id === assumed.id) return setOpen(false);
    const changed = await assume(group);
    setRefused(!changed);
    if (changed) setOpen(false);
  };

  return (
    <div className="switch" ref={root}>
      <button
        type="button"
        ref={toggle}
        className="hub compact"
        title={t("groupSwitch")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
      >
        <GroupName group={assumed} />
        <Icon name="chevrons" size={16} className="chev" />
      </button>
      {open ? (
        <div className="drop group-drop">
          <div className="hubs">
            <div className="eyebrow">{t("groupYours")}</div>
            {refused ? <ErrorLine>{t("groupChangeFailed")}</ErrorLine> : null}
            {ordered.map((group) => (
              <button
                key={group.id}
                type="button"
                className={group.id === assumed.id ? "hub" : "hub other"}
                aria-current={group.id === assumed.id ? "true" : undefined}
                onClick={() => pick(group)}
              >
                <Badge>{initials(group.name)}</Badge>
                <span className="hub-text">
                  <span className="hub-name">{group.name}</span>
                  <span className="hub-meta">{rolesOf(group)}</span>
                </span>
                {group.id === assumed.id ? (
                  <Icon name="check" size={16} stroke={2.6} className="tick" />
                ) : (
                  <span className="hub-go">{t("groupUse")}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
