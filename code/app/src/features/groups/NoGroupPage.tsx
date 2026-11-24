import { useNavigate } from "react-router-dom";
import { Shell } from "../../app/Shell";
import { useLanguage } from "../../shared/language/language";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { signOut } from "../account/signOut";

export function NoGroupPage({ onCheckAgain }: { onCheckAgain: () => void }) {
  const { words } = useLanguage();
  const navigate = useNavigate();
  const leave = async () => {
    await signOut();
    navigate("/sign-in", { replace: true });
  };
  return (
    <Shell tabless title={words.groupNoneTitle}>
      <Card empty>
        <p>{words.groupNoneBody}</p>
        <Button onClick={onCheckAgain}>{words.groupCheckAgain}</Button>
        <Button onClick={() => navigate("/profile")}>{words.profileTitle}</Button>
        <Button kind="danger" onClick={leave}>
          {words.signOutTitle}
        </Button>
      </Card>
    </Shell>
  );
}
