import type { PageModule } from "../../data/types";

export const pages: Record<string, PageModule> = {};

export const pageModule = (id: string): PageModule | undefined => pages[id];

export const clearPages = () => {
  for (const id of Object.keys(pages)) delete pages[id];
};
