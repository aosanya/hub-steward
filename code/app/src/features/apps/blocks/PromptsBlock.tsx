export function PromptsBlock({ prompts, onPrompt }: { prompts: string[]; onPrompt: (text: string) => void }) {
  return (
    <div className="sugg">
      {prompts.map((prompt) => (
        <button key={prompt} type="button" className="sg" onClick={() => onPrompt(prompt)}>
          {prompt}
        </button>
      ))}
    </div>
  );
}
