import { controlsChat } from "./controls";
import { goalsChat } from "./goals";
import { consequencesChat, hazardsChat, threatsChat } from "./library";
import { modulesChat } from "./modules";
import { objectivesChat } from "./objectives";
import { profileChat } from "./profile";
import { publishChat } from "./publish";
import { risksChat } from "./risks";
import { rolesChat } from "./roles";
import { testChat } from "./test";
import { usageChat, usagePageIds } from "./usage";
import { withoutMeasuresOff } from "../features";
import type { PageChat } from "./types";
import { workflowsChat } from "./workflows";

const pages: Record<string, PageChat> = {
  goals: goalsChat,
  objectives: objectivesChat,
  roles: rolesChat,
  risks: risksChat,
  bowties: risksChat,
  hazards: hazardsChat,
  threats: threatsChat,
  consequences: consequencesChat,
  controls: controlsChat,
  modules: modulesChat,
  workflows: workflowsChat,
  test: testChat,
  ...Object.fromEntries(usagePageIds.map((id) => [id, usageChat])),
  profile: profileChat,
  publish: publishChat,
};

const shown = (chat: PageChat): PageChat => ({
  reads: withoutMeasuresOff(chat.reads),
  writes: withoutMeasuresOff(chat.writes),
  ...(chat.suggests ? { suggests: withoutMeasuresOff(chat.suggests) } : {}),
});

const reviewSections: Record<string, string> = {
  "review-profile": "profile",
  "review-goals": "goals",
  "review-objectives": "objectives",
  "review-roles": "roles",
  "review-workflows": "workflows",
  "review-risks": "bowties",
  "review-tests": "test",
};

export const chatPageOf = (page: string): PageChat | null => {
  const section = Object.hasOwn(reviewSections, page) ? reviewSections[page] : page;
  if (!Object.hasOwn(pages, section)) return null;
  const { reads, writes, suggests } = shown(pages[section]);
  return section === page ? { reads, writes, suggests } : { reads, writes };
};
