import {
  consequenceRows,
  createConsequence,
  createHazard,
  createThreat,
  deleteConsequence,
  deleteHazard,
  deleteThreat,
  hazardRows,
  threatRows,
  updateConsequence,
  updateHazard,
  updateThreat,
  type Bowtie,
  type LibraryKind,
  type PartInput,
} from "../../data/pages/library";

export type LibraryEntry = {
  id: string;
  code: string;
  title: string;
  description: string;
  usedIn: number;
  unguarded: boolean;
  hazardCode?: string;
  hazardTitle?: string;
  hazardId?: string;
  bowties?: Bowtie[];
};

type Plain = { id: string; code: string; title: string; description: string; usedIn: number; unguarded?: boolean; hazardCode?: string; hazardTitle?: string; hazardId?: string; bowties?: Bowtie[] };

type KindSetup = {
  pageId: string;
  menuKey: string;
  addKey: string;
  editKey: string;
  guarded: boolean;
  load: (hubId: string) => Promise<Plain[]>;
  create: (hubId: string, input: PartInput) => Promise<unknown>;
  update: (hubId: string, id: string, input: PartInput) => Promise<unknown>;
  remove: (hubId: string, id: string) => Promise<unknown>;
};

export const kindSetups: Record<LibraryKind, KindSetup> = {
  hazard: {
    pageId: "hazards",
    menuKey: "menu.hazards",
    addKey: "library.addHazard",
    editKey: "library.editHazard",
    guarded: false,
    load: (hubId) => hazardRows(hubId),
    create: (hubId, input) => createHazard(hubId, input),
    update: (hubId, id, input) => updateHazard(hubId, id, input),
    remove: deleteHazard,
  },
  threat: {
    pageId: "threats",
    menuKey: "menu.threats",
    addKey: "library.addThreat",
    editKey: "library.editThreat",
    guarded: true,
    load: (hubId) => threatRows(hubId),
    create: (hubId, input) => createThreat(hubId, input),
    update: (hubId, id, input) => updateThreat(hubId, id, input),
    remove: deleteThreat,
  },
  consequence: {
    pageId: "consequences",
    menuKey: "menu.consequences",
    addKey: "library.addConsequence",
    editKey: "library.editConsequence",
    guarded: true,
    load: (hubId) => consequenceRows(hubId),
    create: (hubId, input) => createConsequence(hubId, input),
    update: (hubId, id, input) => updateConsequence(hubId, id, input),
    remove: deleteConsequence,
  },
};

export const loadEntries = async (hubId: string, kind: LibraryKind): Promise<LibraryEntry[]> =>
  (await kindSetups[kind].load(hubId)).map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    usedIn: row.usedIn,
    unguarded: row.unguarded ?? false,
    hazardCode: row.hazardCode,
    hazardTitle: row.hazardTitle,
    hazardId: row.hazardId,
    bowties: row.bowties,
  }));
