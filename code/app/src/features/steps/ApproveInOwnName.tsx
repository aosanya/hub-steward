import { readProfile, type Profile } from "../account/profile";
import { useLoad } from "../forms/useLoad";

export function ApproveInOwnName({ read = readProfile }: { read?: () => Promise<Profile> }) {
  const loaded = useLoad(read, "approver");
  if (loaded.state !== "ready") return null;
  const name = loaded.data.name.trim();
  if (!name) return <p className="meta">Your name is not set. Add it in your profile before you approve.</p>;
  return (
    <>
      <p>You approve this in your own name, as {name}.</p>
      <p className="meta">The time and your name are recorded with your answer.</p>
    </>
  );
}
