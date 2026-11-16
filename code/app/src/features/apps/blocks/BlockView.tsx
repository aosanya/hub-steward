import "./blocks.css";
import { CardsBlock } from "./CardsBlock";
import { FormBlock } from "./FormBlock";
import { PromptsBlock } from "./PromptsBlock";
import { TextBlock } from "./TextBlock";
import type { Block, ToolRunner } from "./types";

type Props = {
  block: Block;
  onPrompt: (text: string) => void;
  onTool: ToolRunner;
};

export function BlockView({ block, onPrompt, onTool }: Props) {
  switch (block.kind) {
    case "text":
      return <TextBlock from={block.from} text={block.text} />;
    case "prompts":
      return <PromptsBlock prompts={block.prompts} onPrompt={onPrompt} />;
    case "cards":
      return <CardsBlock cards={block.cards} shown={block.shown} more={block.more} onPrompt={onPrompt} onTool={onTool} />;
    case "form":
      return (
        <FormBlock
          title={block.title}
          fields={block.fields}
          submitLabel={block.submitLabel}
          fixedArgs={block.fixedArgs}
          onSubmit={(args) => onTool(block.tool, args)}
        />
      );
  }
}
