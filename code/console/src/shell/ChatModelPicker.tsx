import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "../i18n";
import { Icon } from "../ui/Icon";
import type { ChatModelOption } from "./useChatModels";

type ChatModelPickerProps = { options: ChatModelOption[]; currentId: string; onPick: (id: string) => void };

export function ChatModelPicker({ options, currentId, onPick }: ChatModelPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const prefix = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      chip.current?.focus();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (options.length === 0) return null;

  const current = options.find((option) => option.id === currentId) ?? options[0];
  const optionId = (index: number) => `${prefix}-${index}`;

  const show = () => {
    setActive(Math.max(0, options.indexOf(current)));
    setOpen(true);
  };

  const choose = (id: string) => {
    onPick(id);
    setOpen(false);
    chip.current?.focus();
  };

  const onChipKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    show();
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: active >= last ? 0 : active + 1,
      ArrowUp: active <= 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[active].id);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <span className="chat-model" ref={root}>
      <button
        type="button"
        ref={chip}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onChipKey}
      >
        {current.label}
        <Icon name="chevron" size={14} stroke={2.2} />
      </button>
      {open ? (
        <ul
          className="chat-model-list"
          role="listbox"
          aria-label={t("models.model")}
          aria-activedescendant={optionId(active)}
          tabIndex={-1}
          ref={list}
          onKeyDown={onListKey}
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={option.id === current.id}
              data-active={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option.id)}
            >
              {option.label}
              {option.id === current.id ? <Icon name="check" size={14} stroke={2.4} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}
