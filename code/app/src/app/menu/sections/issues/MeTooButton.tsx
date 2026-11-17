import { Button } from "../../../../shared/ui/Button";

export const meTooWords = "Me too";

export const saidMeTooWords = "You said Me too";

export const meTooFailedWords = "Your Me too could not be sent.";

type Props = { title: string; said: boolean; failed: boolean; onPress: () => void };

export function MeTooButton({ title, said, failed, onPress }: Props) {
  return (
    <>
      {said ? <Button disabled>{saidMeTooWords}</Button> : <Button aria-label={`${meTooWords}: ${title}`} onClick={onPress}>{meTooWords}</Button>}
      {failed ? <p role="alert">{meTooFailedWords}</p> : null}
    </>
  );
}
