import { Button } from "../ui/Button";

export function OptionButtons({ options, onPick }: { options: string[]; onPick: (option: string) => void }) {
  return (
    <div className="rm-btns">
      {options.map((option) => (
        <Button key={option} onClick={() => onPick(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}
