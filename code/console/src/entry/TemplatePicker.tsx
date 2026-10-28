import { useI18n } from "../i18n";
import { Glyph } from "../ui";
import { Icon } from "../ui/Icon";
import { countsOf } from "./counts";
import { templates } from "./templates";

type TemplatePickerProps = { chosen: string; onChoose: (id: string) => void };

export function TemplatePicker({ chosen, onChoose }: TemplatePickerProps) {
  const { t } = useI18n();
  const label = t("createStartFrom");
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <span className="field-label">{label}</span>
      <div className="ent-picks">
        {templates.map((template) => {
          const on = template.id === chosen;
          return (
            <label key={template.id} className={on ? "ent-pick on" : "ent-pick"}>
              <input
                className="sr"
                type="radio"
                name="template"
                value={template.id}
                checked={on}
                onChange={() => onChoose(template.id)}
              />
              <span className="ent-pick-top">
                <Glyph name={template.icon} />
                <span className="ent-radio">{on ? <Icon name="check" size={12} stroke={3.2} /> : null}</span>
              </span>
              <span className="ent-pick-name">{t(template.nameKey)}</span>
              <span className="count">{countsOf(template, t)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
