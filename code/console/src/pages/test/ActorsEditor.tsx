import { useI18n } from "../../i18n";
import { Button, Note, Row, SelectControl, Stack, TextControl } from "../../ui";
import type { ActorDraft, RoleChoice } from "../../data/scenario";

type Props = {
  actors: ActorDraft[];
  roles: RoleChoice[];
  duplicate: boolean;
  builtIn?: string[];
  note?: string;
  onChange: (actors: ActorDraft[]) => void;
};

export function ActorsEditor({
  actors,
  roles,
  duplicate,
  builtIn = [],
  note,
  onChange,
}: Props) {
  const { t } = useI18n();
  const options = roles.map((role) => ({ value: role.id, label: role.name }));
  const change = (index: number, part: Partial<ActorDraft>) =>
    onChange(
      actors.map((actor, at) => (at === index ? { ...actor, ...part } : actor)),
    );
  return (
    <Stack gap={12}>
      {actors.map((actor, index) => (
        <Row key={index}>
          <TextControl
            label={t("test.colActor")}
            value={actor.name}
            onChange={(name) => change(index, { name })}
          />
          <SelectControl
            label={t("test.colRole")}
            value={actor.roleId}
            options={options}
            onChange={(roleId) => change(index, { roleId })}
          />
          <Button
            kind="quiet"
            size="sm"
            onClick={() => onChange(actors.filter((_, at) => at !== index))}
          >
            {t("test.remove")}
          </Button>
        </Row>
      ))}
      {builtIn.map((name) => (
        <Row key={name}>
          <span>{name}</span>
          <span className="muted">{t("test.builtIn")}</span>
        </Row>
      ))}
      {note ? <Note>{note}</Note> : null}
      {duplicate ? (
        <p className="field-error error">{t("test.duplicateActor")}</p>
      ) : null}
      <Row>
        <Button
          kind="quiet"
          size="sm"
          icon="plus"
          disabled={options.length === 0}
          onClick={() =>
            onChange([...actors, { name: "", roleId: options[0]?.value ?? "" }])
          }
        >
          {t("test.addActor")}
        </Button>
      </Row>
    </Stack>
  );
}
