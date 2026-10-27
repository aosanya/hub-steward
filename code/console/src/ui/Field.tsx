import { useId, type ChangeEvent, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { ControlFrame, FileControl, OptionControl, ReadonlyControl, SecretControl, textOf, type ControlAttrs } from "./fieldControls";
import { optionItems } from "./fieldValues";
import { Icon } from "./Icon";
import type { FieldProps } from "./props";
import { Toggle } from "./Toggle";

const listOf = (value: unknown) =>
  textOf(value)
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);

export function Field({ spec, value, onChange, error, hint, disabled, unit, placeholder, set, layout = "stack" }: FieldProps) {
  const { t } = useI18n();
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const translated = t("field." + spec.name);
  const name = translated === "field." + spec.name ? spec.name : translated;
  const options = optionItems(spec);
  const picks = spec.component === "chips" && options.length > 0;
  const grouped = spec.component === "radios" || spec.component === "toggle" || picks;
  const off = disabled === true;
  const bad = Boolean(error);
  const required = spec.required ? true : undefined;
  const attrs: ControlAttrs = {
    id,
    name: spec.name,
    disabled: off,
    "aria-invalid": bad ? true : undefined,
    "aria-describedby": bad ? errorId : undefined,
  };
  const frame = { bad, off };
  const typed = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(e.target.value);

  const control = (): ReactNode => {
    switch (spec.component) {
      case "secret":
        return <SecretControl attrs={attrs} frame={frame} required={required} value={value} placeholder={placeholder} set={set} onChange={onChange} />;
      case "textarea":
        return (
          <ControlFrame {...frame}>
            <textarea {...attrs} rows={4} required={required} placeholder={placeholder} value={textOf(value)} onChange={typed} />
          </ControlFrame>
        );
      case "number":
        return (
          <ControlFrame {...frame}>
            <input
              {...attrs}
              type="number"
              required={required}
              placeholder={placeholder ?? "0"}
              value={textOf(value)}
              onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            />
            {unit ? <span className="unit">{unit}</span> : null}
          </ControlFrame>
        );
      case "select":
        return (
          <ControlFrame {...frame}>
            <select {...attrs} required={required} value={textOf(value)} onChange={typed}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={16} />
          </ControlFrame>
        );
      case "radios":
        return (
          <OptionControl
            name={spec.name}
            labelledBy={labelId}
            options={options}
            off={off}
            multiple={false}
            isOn={(option) => textOf(value) === option.value}
            onPick={(option) => onChange(option.value)}
          />
        );
      case "toggle":
        return (
          <Toggle
            id={id}
            name={spec.name}
            labelledBy={labelId}
            on={value === true}
            disabled={off}
            label={t(value === true ? "ui.on" : "ui.off")}
            onChange={onChange}
          />
        );
      case "date":
        return (
          <ControlFrame {...frame}>
            <Icon name="calendar" size={16} />
            <input {...attrs} type="date" required={required} value={textOf(value)} onChange={typed} />
          </ControlFrame>
        );
      case "chips":
        if (picks)
          return (
            <OptionControl
              name={spec.name}
              labelledBy={labelId}
              options={options}
              off={off}
              multiple
              isOn={(option) => listOf(value).includes(option.value)}
              onPick={(option) => {
                const chosen = listOf(value);
                onChange((chosen.includes(option.value) ? chosen.filter((item) => item !== option.value) : [...chosen, option.value]).join(", "));
              }}
            />
          );
        return (
          <ControlFrame {...frame}>
            <input {...attrs} type="text" placeholder={placeholder ?? t("commaSeparated")} value={textOf(value)} onChange={typed} />
          </ControlFrame>
        );
      case "file":
        return <FileControl attrs={attrs} frame={frame} value={value} onChange={onChange} />;
      case "readonly":
        return <ReadonlyControl attrs={attrs} frame={frame} value={value} />;
      default:
        return (
          <ControlFrame {...frame}>
            <input
              {...attrs}
              type="text"
              required={required}
              readOnly={spec.readOnly}
              placeholder={placeholder}
              value={textOf(value)}
              onChange={typed}
            />
            {unit ? <span className="unit">{unit}</span> : null}
          </ControlFrame>
        );
    }
  };

  const mark = spec.required ? (
    <>
      <span className="sr"> </span>
      <span className="req">*</span>
    </>
  ) : null;
  const labelClass = layout === "rows" ? "setting-label" : "field-label";
  const label = grouped ? (
    <span className={labelClass} id={labelId}>
      {name}
      {mark}
    </span>
  ) : (
    <label className={labelClass} htmlFor={id}>
      {name}
      {mark}
    </label>
  );
  const problem = error ? (
    <span className="field-error" id={errorId}>
      {error}
    </span>
  ) : null;

  if (layout === "rows")
    return (
      <div className="setting">
        {label}
        <div className="setting-control">
          {problem ? (
            <div className="field">
              {control()}
              {problem}
            </div>
          ) : (
            control()
          )}
        </div>
      </div>
    );

  return (
    <div className="field">
      {label}
      {control()}
      {hint ? <span className="hint">{hint}</span> : null}
      {problem}
    </div>
  );
}
