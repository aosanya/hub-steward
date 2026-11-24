import { useState } from "react";
import { rolesOf, type MyGroup } from "../data/groups";
import { useI18n } from "../i18n";
import { Button, Card, Chip, Detail, Grid, Row } from "../ui";
import { EntryScreen } from "./EntryScreen";
import { ErrorLine } from "./ErrorLine";

type GroupPickProps = { groups: MyGroup[]; onPick: (group: MyGroup) => Promise<boolean>; onLeave: () => void };

function Tags({ tags }: { tags?: string[] }) {
  const { t } = useI18n();
  if (!tags) return null;
  if (tags.length === 0) return <Chip kind="warn">{t("groupNoTag")}</Chip>;
  return (
    <>
      {tags.map((tag) => (
        <Chip key={tag}>{tag}</Chip>
      ))}
    </>
  );
}

export function GroupPick({ groups, onPick, onLeave }: GroupPickProps) {
  const { t } = useI18n();
  const [refused, setRefused] = useState(false);

  const pick = async (group: MyGroup) => {
    setRefused(!(await onPick(group)));
  };

  return (
    <EntryScreen onSignOut={onLeave}>
      <div className="ent-list">
        <h1>{t("groupChoose")}</h1>
        {refused ? <ErrorLine>{t("groupChangeFailed")}</ErrorLine> : null}
        <Grid min={16}>
          {groups.map((group) => (
            <Card key={group.id}>
              <div className="ent-hub-head">
                <div className="ent-hub-name">
                  <h3>{group.name}</h3>
                  <Row gap={6}>
                    <Tags tags={group.tags} />
                  </Row>
                </div>
              </div>
              <Detail pairs={[[t("groupRoles"), rolesOf(group)]]} />
              <Button kind="quiet" size="sm" icon="arrow" wide onClick={() => pick(group)}>
                {t("groupContinue")}
              </Button>
            </Card>
          ))}
        </Grid>
      </div>
    </EntryScreen>
  );
}
