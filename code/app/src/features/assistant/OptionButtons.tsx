import { Button } from "../../shared/ui/Button";

export function OptionButtons({ options, onPick }: { options: string[]; onPick: (option: string) => void }) {
  return (
    <div className="rm-btns rm-choices">
      {options.map((option) => (
        <Button key={option} onClick={() => onPick(option)}>
          <span>{option}</span>
          <span className="chev" aria-hidden="true">›</span>
        </Button>
      ))}
    </div>
  );
}
