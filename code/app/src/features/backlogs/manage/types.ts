import type { DraftStep } from "./stepsDraft";

export type BacklogDetail = { id: string; name: string; steps: DraftStep[] };

export type BacklogManageClient = {
  mayManage: () => Promise<boolean>;
  read: (backlogId: string) => Promise<BacklogDetail>;
  create: (name: string, steps: string[]) => Promise<string>;
  save: (backlogId: string, name: string, steps: DraftStep[]) => Promise<void>;
  remove: (backlogId: string) => Promise<void>;
};

export class ManageRefused extends Error {}

export const refusalWords = (error: unknown, fallback: string) => (error instanceof ManageRefused && error.message !== "" ? error.message : fallback);
