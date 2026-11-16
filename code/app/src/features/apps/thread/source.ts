import type { Block } from "../blocks/types";

export type AgentSource = {
  opening(): Promise<Block[]>;
  reply(text: string, thread: Block[]): Promise<Block[]>;
  submit(block: Block, args: Record<string, unknown>): Promise<Block[]>;
};
