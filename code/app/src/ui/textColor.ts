import type { ChipTone } from "./Chip";

const firstHue = 185;
const hueSpan = 145;
const shades = 5;

const hashOf = (text: string) => [...text].reduce((sum, letter) => (Math.imul(sum, 6875) + letter.charCodeAt(0)) >>> 0, 2166136261);

export const hueOf = (text: string) => firstHue + (hashOf(text) % hueSpan);

export const shadeOf = (text: string) => Math.floor(hashOf(text) / hueSpan) % shades;

const toneOf = (text: string): ChipTone | undefined => (text === "Ready" ? "success" : text === "Blocked" ? "danger" : undefined);

export const textLook = (text: string) => {
  const tone = toneOf(text);
  return tone ? { tone } : { hue: hueOf(text), shade: shadeOf(text) };
};
