import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import type { OptionItem } from "../types";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Icon } from "./Icon";

export type ControlAttrs = {
  id: string;
  name: string;
  disabled: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

type Frame = { bad: boolean; off: boolean; children: ReactNode };

export const textOf = (value: unknown) => (value === undefined || value === null ? "" : String(value));

export function ControlFrame({ bad, off, children }: Frame) {
  const classes = ["control", "ctl", bad ? "bad" : "", off ? "off" : ""].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}

type SecretProps = {
  attrs: ControlAttrs;
  frame: Omit<Frame, "children">;
  required?: boolean;
  value: unknown;
  placeholder?: string;
  set?: boolean;
  onChange: (value: string) => void;
};

export function SecretControl({ attrs, frame, required, value, placeholder, set, onChange }: SecretProps) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  return (
    <ControlFrame {...frame}>
      <Icon name="key" size={16} />
      <input
        {...attrs}
        type={shown ? "text" : "password"}
        autoComplete="off"
        required={required}
        placeholder={placeholder ?? t("models.paste")}
        value={textOf(value)}
        onChange={(e) => onChange(e.target.value)}
      />
      {set ? <Chip kind="ok">{t("modelKeySet")}</Chip> : null}
      <button
        type="button"
        className="ctl-btn"
        aria-label={t(shown ? "models.hideKey" : "models.showKey")}
        disabled={attrs.disabled}
        onClick={() => setShown(!shown)}
      >
        <Icon name="eye" size={18} />
      </button>
    </ControlFrame>
  );
}

type FileProps = { attrs: ControlAttrs; frame: Omit<Frame, "children">; value: unknown; onChange: (file: File | null) => void };

export function FileControl({ attrs, frame, value, onChange }: FileProps) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const file = value instanceof File ? value : null;
  return (
    <ControlFrame {...frame}>
      <Icon name="paperclip" size={16} />
      <span className="soft">{file ? file.name : t("ui.noFile")}</span>
      <input {...attrs} ref={input} className="sr" type="file" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <Button kind="quiet" size="xs" disabled={attrs.disabled} onClick={() => input.current?.click()}>
        {t("ui.choose")}
      </Button>
    </ControlFrame>
  );
}

type ReadonlyProps = { attrs: ControlAttrs; frame: Omit<Frame, "children">; value: unknown };

export function ReadonlyControl({ attrs, frame, value }: ReadonlyProps) {
  const { t } = useI18n();
  return (
    <ControlFrame {...frame}>
      <input {...attrs} className="count" type="text" readOnly value={textOf(value)} />
      <Button kind="quiet" size="xs" icon="copy" disabled={attrs.disabled} onClick={() => navigator.clipboard.writeText(textOf(value))}>
        {t("copy")}
      </Button>
    </ControlFrame>
  );
}

type OptionsProps = {
  name: string;
  labelledBy: string;
  options: OptionItem[];
  off: boolean;
  multiple: boolean;
  isOn: (option: OptionItem) => boolean;
  onPick: (option: OptionItem) => void;
};

export function OptionControl({ name, labelledBy, options, off, multiple, isOn, onPick }: OptionsProps) {
  return (
    <div className="opts" role={multiple ? "group" : "radiogroup"} aria-labelledby={labelledBy}>
      {options.map((option) => {
        const on = isOn(option);
        const classes = ["opt", on ? "on" : "", off ? "off" : ""].filter(Boolean).join(" ");
        return (
          <label key={option.value} className={classes}>
            <input
              className="sr"
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={option.value}
              checked={on}
              disabled={off}
              onChange={() => onPick(option)}
            />
            <span className={multiple ? "opt-box" : "opt-dot"} />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
