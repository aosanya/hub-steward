import { useI18n } from "../../i18n";
import { Chip, type ChipKind } from "../../ui";

const looks: Record<string, [ChipKind, string]> = {
  online: ["ok", "stateOnline"],
  fault: ["bad", "stateFault"],
  offline: ["bad", "stateOffline"],
  "no network": ["bad", "stateNoNetwork"],
  open: ["bad", "stateOpen"],
  closed: ["mute", "stateClosed"],
  acknowledged: ["warn", "stateAcknowledged"],
  "switched on": ["ok", "stateSwitchedOn"],
  "switched off": ["mute", "stateSwitchedOff"],
};

export function StateChip({ state }: { state: string }) {
  const { t } = useI18n();
  const look = Object.hasOwn(looks, state.toLowerCase()) ? looks[state.toLowerCase()] : null;
  return look ? <Chip kind={look[0]}>{t(look[1])}</Chip> : <Chip kind="mute">{state}</Chip>;
}
