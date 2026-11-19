import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBackOrHome } from "../../app/useBackOrHome";
import { useLanguage } from "../../shared/language/language";
import { Button } from "../../shared/ui/Button";
import { Shell } from "../../app/Shell";
import { readProfile } from "./profile";
import { signOut } from "./signOut";

export function SignOutPage() {
  const { words } = useLanguage();
  const navigate = useNavigate();
  const back = useBackOrHome();
  const [name, setName] = useState("");

  useEffect(() => {
    let live = true;
    readProfile()
      .then((profile) => live && setName(profile.name))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const leave = async () => {
    await signOut();
    navigate("/sign-in", { replace: true });
  };

  return (
    <Shell tabless title={words.signOutTitle} onBack={back}>
      {name ? <p className="note">{words.signOutSignedInAs.replace("{name}", name)}</p> : null}
      <Button kind="danger" onClick={leave}>
        {words.signOutTitle}
      </Button>
    </Shell>
  );
}
