import type { ThemeChoice } from "./props";

export const themeChoices: ThemeChoice[] = [
  { key: "dark", label: "Dark", colours: ["#0F0E0C", "#1A1815", "#E8A33D"] },
  { key: "light", label: "Light", colours: ["#F6F2EA", "#FFFFFF", "#9F4D06"] },
  { key: "midnight", label: "Midnight", colours: ["#0A0F1C", "#121A2E", "#5CB8F5"] },
  { key: "forest", label: "Forest", colours: ["#08110C", "#101E16", "#8FD19E"] },
  { key: "contrast", label: "High contrast", colours: ["#000000", "#0A0A0A", "#FFE600"] },
];
